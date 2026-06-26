import { SQL_TIPO_PUBLICO } from './listasTipo.js';

// Busqueda del header: SUBSTRING + ACCENT-INSENSITIVE + case-insensitive, para que matchee
// mientras se escribe (q='si' encuentra 'Simon') y sin importar tildes (q='Simon'=='Simon').
// unaccent(columna) ILIKE unaccent('%q%') sobre nombre + cedula (parcial). Fallecidos fuera.

// Reportes del directorio (personas_intel), excluye fallecidos y duplicados.
export async function buscarEnReportes(query, q) {
  const SELECT = `SELECT id, nombre_completo, cedula, estado, parroquia, ultima_ubicacion,
                         sector_o_edificio, foto_url, fuente_url, origen, created_at
                  FROM personas_intel
                  WHERE duplicate_of IS NULL AND estado <> 'fallecido'`;
  const params = [`%${q}%`];
  let cedClause = '';
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 2) { params.push(`%${digits}%`); cedClause = ` OR cedula ILIKE $${params.length}`; }
  const { rows } = await query(
    `${SELECT} AND (unaccent(nombre_completo) ILIKE unaccent($1)${cedClause})
     ORDER BY created_at DESC, id DESC LIMIT 100`,
    params
  );
  return rows;
}

// Entradas de listas de hospital (no sensibles -> excluye fallecidos). Devuelve cedula (directiva David).
export async function buscarEnHospitales(query, q, hospital) {
  const conds = [SQL_TIPO_PUBLICO];
  const params = [];
  if (hospital && hospital !== 'todos' && String(hospital).trim()) {
    params.push(`%${String(hospital).trim()}%`);
    conds.push(`l.fuente ILIKE $${params.length}`);
  }
  params.push(`%${q}%`);
  const nombreParam = params.length;
  let cedClause = '';
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 2) { params.push(`%${digits}%`); cedClause = ` OR e.cedula ILIKE $${params.length}`; }
  conds.push(`(unaccent(e.nombre) ILIKE unaccent($${nombreParam})${cedClause})`);

  const { rows } = await query(
    `SELECT e.nombre, e.cedula, e.estado, e.detalle, e.lugar, l.fuente AS hospital, l.id AS lista_id
     FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id
     WHERE ${conds.join(' AND ')} ORDER BY e.nombre LIMIT 100`,
    params
  );
  return rows;
}
