import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { compareNombres } from '../utils/match.js';
import { normalizarCedula } from '../utils/validate.js';
import { SQL_TIPO_PUBLICO } from '../utils/listasTipo.js';

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
// Busqueda DIRIGIDA (requiere q): por CEDULA exacta o por NOMBRE (nombre Y apellido, fuzzy).
// Excluye fallecidos. NO devuelve cedula (privacidad). Es busqueda puntual, no listado masivo.
router.get('/buscar', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return fail(res, "Parametro 'q' requerido (nombre o cedula).");

    const hospital = req.query.hospital;
    const conds = [SQL_TIPO_PUBLICO];
    const params = [];
    if (hospital && hospital !== 'todos' && hospital.trim()) {
      params.push(`%${hospital.trim()}%`);
      conds.push(`l.fuente ILIKE $${params.length}`);
    }

    const SELECT = `SELECT e.nombre, e.estado, e.lugar, l.fuente AS hospital, l.id AS lista_id
                    FROM lista_entradas e JOIN listas_manuscritas l ON l.id = e.lista_id`;

    const ced = normalizarCedula(q);
    let rows;
    if (ced) {
      params.push(ced);
      conds.push(`e.cedula = $${params.length}`);
      rows = (await query(`${SELECT} WHERE ${conds.join(' AND ')} LIMIT 100`, params)).rows;
    } else {
      const toks = q.toLowerCase().split(/\s+/).filter((t) => t.length >= 3).sort((a, b) => b.length - a.length);
      params.push(`%${toks[0] || q}%`);
      conds.push(`e.nombre ILIKE $${params.length}`);
      const cand = (await query(`${SELECT} WHERE ${conds.join(' AND ')} LIMIT 300`, params)).rows;
      const minShared = Math.min(2, Math.max(1, toks.length)); // 1 token -> shared>=1; 2+ -> nombre Y apellido
      rows = cand.filter((r) => compareNombres(q, r.nombre).shared >= minShared).slice(0, 100);
    }

    return ok(res, rows, `${rows.length} coincidencia(s) en hospitales.`);
  } catch (err) {
    next(err);
  }
});

export default router;
