import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { SQL_TIPO_PUBLICO } from '../utils/listasTipo.js';
import { buscarEnHospitales } from '../utils/busqueda.js';

const router = Router();

// GET /api/hospitales -> hospitales (fuente) con listas NO sensibles: total pacientes + tipos.
// Son los "botones" de hospital. Excluye fallecidos. Metadata agregada (sin datos de pacientes).
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT l.fuente AS hospital, count(e.id)::int AS total, array_agg(DISTINCT l.tipo) AS tipos
       FROM listas_manuscritas l JOIN lista_entradas e ON e.lista_id = l.id
       WHERE ${SQL_TIPO_PUBLICO} AND l.fuente IS NOT NULL AND l.fuente <> ''
       GROUP BY l.fuente ORDER BY total DESC`
    );
    return ok(res, rows, 'Hospitales con listas.');
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
