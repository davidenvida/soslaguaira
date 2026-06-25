import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { toIntOrNull } from '../utils/validate.js';
import { compareNombres } from '../utils/match.js';
import { SQL_TIPO_PUBLICO } from '../utils/listasTipo.js';
import { buscarEnHospitales } from '../utils/busqueda.js';

const router = Router();

// SQL para los "botones"/filtro de hospitales (reusado).
const SQL_HOSPITALES = `SELECT l.fuente AS hospital, count(e.id)::int AS total, array_agg(DISTINCT l.tipo) AS tipos
  FROM listas_manuscritas l JOIN lista_entradas e ON e.lista_id = l.id
  WHERE ${SQL_TIPO_PUBLICO} AND l.fuente IS NOT NULL AND l.fuente <> ''
  GROUP BY l.fuente ORDER BY total DESC`;

// GET /api/hospitales -> hospitales (fuente) con listas NO sensibles: total pacientes + tipos.
// Son los "botones" de hospital. Excluye fallecidos. Metadata agregada (sin datos de pacientes).
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(SQL_HOSPITALES);
    return ok(res, rows, 'Hospitales con listas.');
  } catch (err) {
    next(err);
  }
});

// GET /api/hospitales/personas?hospital=<todos|nombre>&page=&limit=
// Lista COMPLETA de pacientes (excluye fallecidos), paginada, con la COINCIDENCIA precomputada
// por entrada: matchea un desaparecido reportado (cedula exacta o nombre+apellido)? Cedulas visibles.
router.get('/personas', async (req, res, next) => {
  try {
    const hospital = req.query.hospital;
    const conds = [SQL_TIPO_PUBLICO];
    const params = [];
    if (hospital && hospital !== 'todos' && String(hospital).trim()) {
      params.push(`%${String(hospital).trim()}%`);
      conds.push(`l.fuente ILIKE $${params.length}`);
    }
    const where = conds.join(' AND ');

    const limRaw = toIntOrNull(req.query.limit);
    const pageRaw = toIntOrNull(req.query.page);
    const limit = limRaw === null ? 50 : Math.min(Math.max(limRaw, 1), 500);
    const offset = pageRaw !== null ? Math.max(pageRaw - 1, 0) * limit : Math.max(toIntOrNull(req.query.offset) || 0, 0);

    // Indice de desaparecidos/desconocidos reportados (se carga 1 vez por request).
    const desap = (await query(
      `SELECT id, nombre_completo, cedula, estado FROM personas_intel
       WHERE duplicate_of IS NULL AND estado IN ('desaparecido','desconocido')`
    )).rows;
    const porCedula = new Map();
    for (const d of desap) if (d.cedula) porCedula.set(d.cedula, d);

    const conCoincidencia = (r) => {
      let rep = (r.cedula && porCedula.get(r.cedula)) || null;
      if (!rep) rep = desap.find((d) => compareNombres(r.nombre, d.nombre_completo).shared >= 2) || null;
      return {
        nombre: r.nombre, cedula: r.cedula, hospital: r.hospital, estado: r.estado, lugar: r.lugar,
        coincidencia: rep
          ? { hay: true, reporte: { id: rep.id, nombre_completo: rep.nombre_completo, estado: rep.estado } }
          : { hay: false, reporte: null },
      };
    };

    const filtroCoinc = req.query.coincidencia; // con | sin | todos(default)
    const SELECT_ROW = `SELECT e.nombre, e.cedula, e.estado, e.lugar, l.fuente AS hospital
                        FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id WHERE ${where}`;

    let items;
    let total;
    if (filtroCoinc === 'con' || filtroCoinc === 'sin') {
      // Computar coincidencia ANTES de paginar (filtra el set completo, luego pagina en memoria).
      const all = (await query(`${SELECT_ROW} ORDER BY l.fuente, e.id`, params)).rows.map(conCoincidencia);
      const filtered = all.filter((it) => (filtroCoinc === 'con' ? it.coincidencia.hay : !it.coincidencia.hay));
      total = filtered.length;
      items = filtered.slice(offset, offset + limit);
    } else {
      total = Number((await query(`SELECT count(*)::int AS c FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id WHERE ${where}`, params)).rows[0].c);
      const pageParams = [...params, limit, offset];
      items = (await query(`${SELECT_ROW} ORDER BY l.fuente, e.id LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`, pageParams)).rows.map(conCoincidencia);
    }

    const hospitales = (await query(SQL_HOSPITALES)).rows;
    return ok(
      res,
      { items, total, limit, page: Math.floor(offset / limit) + 1, pages: Math.max(1, Math.ceil(total / limit)), hospitales },
      `${items.length} de ${total} pacientes.`
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/hospitales/buscar?q=<nombre|cedula>&hospital=<nombre|todos>
// Busqueda DIRIGIDA por CEDULA exacta o NOMBRE (nombre Y apellido). Excluye fallecidos.
// Info COMPLETA con cedula (directiva de David: reunificacion). -> {nombre,cedula,estado,detalle,lugar,hospital,lista_id}
router.get('/buscar', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return fail(res, "Parametro 'q' requerido (nombre o cedula).");
    const rows = await buscarEnHospitales(query, q, req.query.hospital);
    return ok(res, rows, `${rows.length} coincidencia(s) en hospitales.`);
  } catch (err) {
    next(err);
  }
});

export default router;
