import { compareNombres } from './match.js';

// Arma una alerta a partir de una entrada de lista (con datos de su lista por join).
const armar = (e, confianza, motivo) => {
  const fecha = e.created_at ? new Date(e.created_at).toISOString().slice(0, 10) : '';
  const tipo = e.tipo || 'lista';
  const fuente = e.fuente || 'origen desconocido';
  return {
    confianza, // 'alta' (cedula) | 'media' (nombre completo)
    motivo,    // 'cedula' | 'nombre_completo'
    mensaje: `Esta persona aparece en: ${tipo} - ${fuente}${fecha ? ` (${fecha})` : ''}`,
    entrada: { nombre: e.nombre, cedula: e.cedula ?? null, estado: e.estado, lugar: e.lugar },
    lista: { fuente: e.fuente, tipo: e.tipo, fecha },
  };
};

// Cruza un (nombre, cedula) contra lista_entradas y devuelve alertas (cedula=alta, nombre=media).
// Es el motor de reunificacion proactiva: avisa si la persona REPORTADA aparece en una lista.
// PRIVACIDAD: en el flujo de reportes publicos se usa soloCedula=true -> solo coincidencia por
// cedula (misma persona, consentida). El match por nombre podria revelar a un TERCERO del roster
// (dato de salud sin consentimiento), por eso se restringe al cruce interno por cedula.
export async function buscarAlertas(query, nombre, cedula, { soloCedula = false } = {}) {
  const out = [];
  const vistos = new Set();

  if (cedula) {
    const r = await query(
      `SELECT e.nombre, e.cedula, e.estado, e.lugar, l.fuente, l.tipo, l.created_at
       FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id
       WHERE e.cedula = $1`,
      [cedula]
    );
    for (const e of r.rows) {
      out.push(armar(e, 'alta', 'cedula'));
      vistos.add(`${e.nombre}|${e.cedula}`);
    }
  }

  // Prefiltro por el token mas largo del nombre, luego comparacion estricta (nombre Y apellido).
  const toks = soloCedula ? [] : String(nombre || '').toLowerCase().split(/\s+/).filter((t) => t.length >= 4).sort((a, b) => b.length - a.length);
  if (toks.length) {
    const r = await query(
      `SELECT e.nombre, e.cedula, e.estado, e.lugar, l.fuente, l.tipo, l.created_at
       FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id
       WHERE e.nombre ILIKE $1 LIMIT 200`,
      [`%${toks[0]}%`]
    );
    for (const e of r.rows) {
      const key = `${e.nombre}|${e.cedula}`;
      if (vistos.has(key)) continue;
      if (cedula && e.cedula === cedula) continue;
      const { shared } = compareNombres(nombre, e.nombre);
      if (shared >= 2) { out.push(armar(e, 'media', 'nombre_completo')); vistos.add(key); }
    }
  }

  out.sort((a, b) => (a.confianza === 'alta' ? 0 : 1) - (b.confianza === 'alta' ? 0 : 1));
  return out.slice(0, 10);
}
