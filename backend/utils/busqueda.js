import { compareNombres } from './match.js';
import { normalizarCedula } from './validate.js';
import { SQL_TIPO_PUBLICO } from './listasTipo.js';

// Busqueda DIRIGIDA por cedula (exacta) o nombre (nombre Y apellido, fuzzy). Fallecidos fuera.

// Reportes del directorio (personas_intel), excluye fallecidos y duplicados.
export async function buscarEnReportes(query, q) {
  const SELECT = `SELECT id, nombre_completo, cedula, estado, parroquia, ultima_ubicacion,
                         sector_o_edificio, foto_url, fuente_url, origen, created_at
                  FROM personas_intel
                  WHERE duplicate_of IS NULL AND estado <> 'fallecido'`;
  const ced = normalizarCedula(q);
  if (ced) {
    return (await query(`${SELECT} AND cedula = $1 LIMIT 100`, [ced])).rows;
  }
  const toks = q.toLowerCase().split(/\s+/).filter((t) => t.length >= 3).sort((a, b) => b.length - a.length);
  const cand = (await query(`${SELECT} AND nombre_completo ILIKE $1 LIMIT 300`, [`%${toks[0] || q}%`])).rows;
  const minShared = Math.min(2, Math.max(1, toks.length));
  return cand.filter((r) => compareNombres(q, r.nombre_completo).shared >= minShared).slice(0, 100);
}

// Entradas de listas de hospital (no sensibles -> excluye fallecidos). Devuelve cedula (directiva David).
export async function buscarEnHospitales(query, q, hospital) {
  const conds = [SQL_TIPO_PUBLICO];
  const params = [];
  if (hospital && hospital !== 'todos' && String(hospital).trim()) {
    params.push(`%${String(hospital).trim()}%`);
    conds.push(`l.fuente ILIKE $${params.length}`);
  }
  const SELECT = `SELECT e.nombre, e.cedula, e.estado, e.detalle, e.lugar, l.fuente AS hospital, l.id AS lista_id
                  FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id`;

  const ced = normalizarCedula(q);
  if (ced) {
    params.push(ced);
    conds.push(`e.cedula = $${params.length}`);
    return (await query(`${SELECT} WHERE ${conds.join(' AND ')} LIMIT 100`, params)).rows;
  }
  const toks = q.toLowerCase().split(/\s+/).filter((t) => t.length >= 3).sort((a, b) => b.length - a.length);
  params.push(`%${toks[0] || q}%`);
  conds.push(`e.nombre ILIKE $${params.length}`);
  const cand = (await query(`${SELECT} WHERE ${conds.join(' AND ')} LIMIT 300`, params)).rows;
  const minShared = Math.min(2, Math.max(1, toks.length));
  return cand.filter((r) => compareNombres(q, r.nombre).shared >= minShared).slice(0, 100);
}
