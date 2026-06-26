import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { toIntOrNull } from '../utils/validate.js';
import { nombresCoinciden } from '../utils/match.js';
import { SQL_TIPO_PUBLICO } from '../utils/listasTipo.js';
import { buscarEnHospitales } from '../utils/busqueda.js';
import { adminGate } from '../middleware/adminGate.js';

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
      `SELECT id, nombre_completo, cedula, estado, informado_familia, informado_via, informado_at
       FROM personas_intel
       WHERE duplicate_of IS NULL AND estado IN ('desaparecido','desconocido')`
    )).rows;
    const porCedula = new Map();
    for (const d of desap) if (d.cedula) porCedula.set(d.cedula, d);

    const conCoincidencia = (r) => {
      let rep = (r.cedula && porCedula.get(r.cedula)) || null;
      if (!rep) rep = desap.find((d) => nombresCoinciden(r.nombre, d.nombre_completo)) || null;
      return {
        nombre: r.nombre, cedula: r.cedula, hospital: r.hospital, estado: r.estado, lugar: r.lugar,
        lista_id: r.lista_id, lista_fuente: r.hospital, lista_foto_url: r.lista_foto_url, lista_fuente_url: r.lista_fuente_url,
        coincidencia: rep
          ? {
              hay: true,
              reporte: {
                id: rep.id, nombre_completo: rep.nombre_completo, estado: rep.estado,
                informado_familia: rep.informado_familia, informado_via: rep.informado_via, informado_at: rep.informado_at,
              },
            }
          : { hay: false, reporte: null },
      };
    };

    // Acepta con|sin|todos y tambien true|false|si|no|1|0 (tolerante a lo que mande el front).
    const fc = String(req.query.coincidencia || '').toLowerCase();
    const filtroCon = ['con', 'true', 'si', '1'].includes(fc);
    const filtroSin = ['sin', 'false', 'no', '0'].includes(fc);
    const SELECT_ROW = `SELECT e.nombre, e.cedula, e.estado, e.lugar,
                               l.fuente AS hospital, l.id AS lista_id, l.foto_url AS lista_foto_url, l.fuente_url AS lista_fuente_url
                        FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id WHERE ${where}`;

    let items;
    let total;
    if (filtroCon || filtroSin) {
      // Computar coincidencia ANTES de paginar (filtra el set completo, luego pagina en memoria).
      const all = (await query(`${SELECT_ROW} ORDER BY l.fuente, e.id`, params)).rows.map(conCoincidencia);
      const filtered = all.filter((it) => (filtroCon ? it.coincidencia.hay : !it.coincidencia.hay));
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

// GET /api/hospitales/fallecidos  (ADMIN, sensible: nombres de fallecidos)
// Los fallecidos NO viven en personas_intel (ahi hay 0): estan en lista_entradas con estado
// fallecido. Devuelve la lista para la vista admin de /stats. Gate X-Admin-Token.
router.get('/fallecidos', adminGate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.nombre, e.cedula, e.estado, e.lista_id, l.fuente, l.created_at AS fecha
       FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id
       WHERE e.estado ~* 'fallec|muert|occis|obito|morgue|deces'
       ORDER BY l.fuente, e.nombre`
    );
    const items = rows.map((r) => ({
      nombre: r.nombre, cedula: r.cedula, fuente: r.fuente,
      lista_id: r.lista_id, fecha: r.fecha, estado: r.estado,
    }));
    return ok(res, { total: items.length, items }, `${items.length} fallecido(s) en listas de hospital.`);
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
