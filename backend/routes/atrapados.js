import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { oneOf, cleanStr, toIntOrNull, validCoords } from '../utils/validate.js';

const router = Router();

const ESTADOS = ['atrapado', 'en_rescate', 'rescatado', 'fallecido'];

// Contrato: JSON snake_case espejo de columnas, en input y output.

// POST /api/atrapados
router.post('/', writeLimiter, async (req, res, next) => {
  try {
    const b = req.body || {};

    let cantidad = toIntOrNull(b.cantidad_personas);
    if (cantidad === null) cantidad = 1;
    if (cantidad < 1) return fail(res, "Campo 'cantidad_personas' debe ser al menos 1.");

    const estado = b.estado === undefined ? 'atrapado' : b.estado;
    if (!oneOf(estado, ESTADOS)) return fail(res, "Campo 'estado' invalido.");

    const coords = validCoords(b.lat, b.lng);

    const sql = `
      INSERT INTO atrapados
        (cantidad_personas, edificio, piso, lat, lng, direccion, estado, descripcion, foto_url, contacto)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`;
    const params = [
      cantidad,
      cleanStr(b.edificio, 200),
      cleanStr(b.piso, 50),
      coords ? coords.lat : null,
      coords ? coords.lng : null,
      cleanStr(b.direccion, 300),
      estado,
      cleanStr(b.descripcion, 1000),
      cleanStr(b.foto_url, 300),
      cleanStr(b.contacto, 120),
    ];
    const { rows } = await query(sql, params);
    return ok(res, rows[0], 'Reporte de atrapados registrado.', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/atrapados  (orden urgencia: 'atrapado' primero, luego created_at desc)
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
    const sql = `
      SELECT * FROM atrapados
      ${where}
      ORDER BY (CASE WHEN estado = 'atrapado' THEN 0 ELSE 1 END), created_at DESC`;
    const { rows } = await query(sql, params);
    return ok(res, rows, 'Listado de atrapados (priorizado).');
  } catch (err) {
    next(err);
  }
});

// PATCH /api/atrapados/:id  -> actualiza estado y/o campos del rescate
router.patch('/:id', writeLimiter, async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');

    const b = req.body || {};
    const sets = [];
    const params = [];

    if (b.estado !== undefined) {
      if (!oneOf(b.estado, ESTADOS)) return fail(res, "Campo 'estado' invalido.");
      params.push(b.estado);
      sets.push(`estado = $${params.length}`);
    }
    if (b.cantidad_personas !== undefined) {
      const c = toIntOrNull(b.cantidad_personas);
      if (c === null || c < 1) return fail(res, "Campo 'cantidad_personas' invalido.");
      params.push(c);
      sets.push(`cantidad_personas = $${params.length}`);
    }
    if (b.descripcion !== undefined) {
      params.push(cleanStr(b.descripcion, 1000));
      sets.push(`descripcion = $${params.length}`);
    }
    if (b.contacto !== undefined) {
      params.push(cleanStr(b.contacto, 120));
      sets.push(`contacto = $${params.length}`);
    }

    if (!sets.length) return fail(res, 'No hay campos para actualizar.');

    sets.push('updated_at = now()');
    params.push(id);
    const sql = `UPDATE atrapados SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`;
    const { rows } = await query(sql, params);
    if (!rows.length) return fail(res, 'Reporte no encontrado.', 404);
    return ok(res, rows[0], 'Reporte actualizado.');
  } catch (err) {
    next(err);
  }
});

export default router;
