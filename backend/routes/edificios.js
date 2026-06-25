import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import {
  isNonEmptyString, oneOf, cleanStr, toIntOrNull, validCoords,
} from '../utils/validate.js';

const router = Router();

const ESTADOS = ['colapsado', 'dano_grave', 'atrapados', 'en_rescate', 'evacuado_ok'];

// Contrato: JSON snake_case espejo de columnas, en input y output.

// POST /api/edificios
router.post('/', writeLimiter, async (req, res, next) => {
  try {
    const b = req.body || {};

    if (!isNonEmptyString(b.nombre)) return fail(res, "Campo 'nombre' es obligatorio.");
    const estado = b.estado === undefined ? 'dano_grave' : b.estado;
    if (!oneOf(estado, ESTADOS)) return fail(res, "Campo 'estado' invalido.");

    let estimados = toIntOrNull(b.atrapados_estimados);
    if (estimados === null) estimados = 0;
    if (estimados < 0) return fail(res, "Campo 'atrapados_estimados' invalido.");

    const coords = validCoords(b.lat, b.lng);

    const sql = `
      INSERT INTO edificios
        (nombre, lat, lng, direccion, estado, atrapados_estimados, descripcion, foto_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`;
    const params = [
      cleanStr(b.nombre, 200),
      coords ? coords.lat : null,
      coords ? coords.lng : null,
      cleanStr(b.direccion, 300),
      estado,
      estimados,
      cleanStr(b.descripcion, 1000),
      cleanStr(b.foto_url, 300),
    ];
    const { rows } = await query(sql, params);
    return ok(res, rows[0], 'Edificio registrado.', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/edificios?estado=
router.get('/', async (req, res, next) => {
  try {
    const { estado } = req.query;
    const conds = [];
    const params = [];
    if (estado) {
      if (!oneOf(estado, ESTADOS)) return fail(res, "Filtro 'estado' invalido.");
      params.push(estado);
      conds.push(`estado = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await query(`SELECT * FROM edificios ${where} ORDER BY created_at DESC`, params);
    return ok(res, rows, 'Listado de edificios.');
  } catch (err) {
    next(err);
  }
});

export default router;
