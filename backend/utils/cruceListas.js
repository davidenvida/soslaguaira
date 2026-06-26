// Cruce REPORTE (personas_intel) <-> LISTAS de hospital (lista_entradas) para reunificacion.
// Regla (spec Hugo SOSVEN2, contrato Bruno):
//  - 'alta' (definitivo): cedula COLUMNA exacta en AMBOS lados (6-8 digitos, ya normalizadas en BD).
//    Sin LIKE/substring. null nunca matchea null. Cedulas de texto libre se IGNORAN en v1.
//  - 'media' (candidato a verificar): nombre+apellido estricto via nombresCoinciden (umbrales fijos).
// PRIVACIDAD: entradas FALLECIDO (por estado o tipo) NUNCA van al payload publico; una coincidencia
//  por cedula contra un fallecido se enruta PRIVADA a coincidencias_sensibles (cola admin).

import { nombresCoinciden, compareNombres } from './match.js';
import { esFallecido } from './alertas.js';

// Lista publicable: typed, no sensible (excluye fallecidos y listas huerfanas sin tipo).
const tipoPublicable = (tipo) =>
  !!tipo && String(tipo).trim() !== '' && !/fallec|muert|morgue|obito|deces/i.test(tipo);

const toItem = (e, score) => ({
  lista_id: e.lista_id,
  fuente: e.fuente,
  tipo: e.tipo,
  entrada: { nombre: e.entrada_nombre, estado: e.entrada_estado, lugar: e.entrada_lugar },
  score,
});

// Cruza UN reporte contra todas las entradas de listas. Devuelve { alta, media } para el payload
// publico y, como efecto, encola en coincidencias_sensibles las coincidencias por cedula con
// listas de fallecidos (dedup). No expone fallecidos al publico.
export async function cruzarReporteConListas(query, persona) {
  const { rows } = await query(
    `SELECT e.lista_id, l.fuente, l.tipo, e.nombre AS entrada_nombre,
            e.cedula AS entrada_cedula, e.estado AS entrada_estado, e.lugar AS entrada_lugar
     FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id`
  );

  const ced = persona.cedula || null; // columna ya normalizada (6-8 digitos) o null
  const alta = [];
  const media = [];
  const sensibles = [];

  for (const e of rows) {
    const cedMatch = !!(ced && e.entrada_cedula && e.entrada_cedula === ced);
    const entradaFallecida = esFallecido({ estado: e.entrada_estado, tipo: e.tipo });

    if (entradaFallecida) {
      // Coincidencia sensible: solo por cedula exacta se enruta a la cola privada (un match
      // difuso por nombre contra un fallecido es demasiado debil para afirmarlo).
      if (cedMatch) sensibles.push(e);
      continue; // jamas al payload publico
    }
    if (!tipoPublicable(e.tipo)) continue; // lista huerfana / no publicable

    if (cedMatch) {
      alta.push(toItem(e, 1));
    } else if (nombresCoinciden(persona.nombre_completo, e.entrada_nombre)) {
      media.push(toItem(e, compareNombres(persona.nombre_completo, e.entrada_nombre).fullSim));
    }
  }

  alta.sort((a, b) => b.score - a.score);
  media.sort((a, b) => b.score - a.score);

  await encolarSensibles(query, persona, sensibles);

  return { alta: alta.slice(0, 100), media: media.slice(0, 100) };
}

// Inserta en coincidencias_sensibles las coincidencias por cedula con listas de fallecidos,
// evitando duplicar la misma (reportado_cedula, entrada_nombre, lista_fuente).
async function encolarSensibles(query, persona, entradas) {
  for (const e of entradas) {
    const dup = await query(
      `SELECT 1 FROM coincidencias_sensibles
       WHERE reportado_cedula = $1 AND entrada_nombre = $2
         AND coalesce(lista_fuente,'') = coalesce($3,'') LIMIT 1`,
      [persona.cedula, e.entrada_nombre, e.fuente]
    );
    if (dup.rows.length) continue;
    await query(
      `INSERT INTO coincidencias_sensibles
         (reportado_nombre, reportado_cedula, reportado_origen, entrada_nombre, entrada_estado, lista_fuente, lista_tipo)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [persona.nombre_completo, persona.cedula, 'revisar-listas', e.entrada_nombre, e.entrada_estado, e.fuente, e.tipo]
    );
  }
}

// ---- Conteos para stats ----

// Pacientes en listas publicas de hospital (excluye fallecidos por tipo de lista Y por estado de entrada).
export async function contarPersonasListasHospital(query) {
  const { rows } = await query(
    `SELECT count(*)::int AS c
     FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id
     WHERE l.tipo IS NOT NULL AND l.tipo <> '' AND l.tipo !~* 'fallec|muert|morgue|obito|deces'
       AND coalesce(e.estado,'') !~* 'fallec|muert|occis|obito|morgue|deces'`
  );
  return rows[0].c;
}

// Reportes del directorio (no-duplicados, no-fallecidos) con >=1 coincidencia (alta o media)
// en listas publicas. CACHE en memoria (TTL) porque el conteo por nombre es O(n*m) y el front
// pollea stats cada 30s. La parte por cedula es SQL exacto; la parte por nombre es JS difuso.
let cachePosibles = { at: 0, val: null };
const TTL_POSIBLES_MS = 120000; // 2 min: el numero cambia despacio (nuevos reportes/listas)

export async function contarPosiblesCoincidencias(query) {
  if (cachePosibles.val !== null && Date.now() - cachePosibles.at < TTL_POSIBLES_MS) {
    return cachePosibles.val;
  }

  // (1) Por CEDULA exacta (rapido, indexado): reportes cuya cedula aparece en una entrada publica.
  const cedRows = (await query(
    `SELECT DISTINCT p.id
     FROM personas_intel p
     JOIN lista_entradas e ON e.cedula = p.cedula
     JOIN listas_manuscritas l ON l.id = e.lista_id
     WHERE p.duplicate_of IS NULL AND p.estado <> 'fallecido' AND p.cedula IS NOT NULL
       AND l.tipo IS NOT NULL AND l.tipo <> '' AND l.tipo !~* 'fallec|muert|morgue|obito|deces'
       AND coalesce(e.estado,'') !~* 'fallec|muert|occis|obito|morgue|deces'`
  )).rows;
  const matched = new Set(cedRows.map((r) => r.id));

  // (2) Por NOMBRE difuso: solo para los reportes que aun no matchearon por cedula.
  const reportes = (await query(
    `SELECT id, nombre_completo FROM personas_intel
     WHERE duplicate_of IS NULL AND estado <> 'fallecido'`
  )).rows;
  const entradas = (await query(
    `SELECT e.nombre FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id
     WHERE l.tipo IS NOT NULL AND l.tipo <> '' AND l.tipo !~* 'fallec|muert|morgue|obito|deces'
       AND coalesce(e.estado,'') !~* 'fallec|muert|occis|obito|morgue|deces'`
  )).rows;

  for (const p of reportes) {
    if (matched.has(p.id)) continue;
    for (const e of entradas) {
      if (nombresCoinciden(p.nombre_completo, e.nombre)) { matched.add(p.id); break; }
    }
  }

  cachePosibles = { at: Date.now(), val: matched.size };
  return matched.size;
}
