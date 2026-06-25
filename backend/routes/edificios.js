import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import {
  isNonEmptyString, oneOf, cleanStr, toIntOrNull, toNumberOrNull, validCoords,
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

// PATCH /api/edificios/:id  -> enriquece campos presentes (merge sin recrear la fila).
router.patch('/:id', writeLimiter, async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');

    const exists = (await query('SELECT id FROM edificios WHERE id = $1', [id])).rows[0];
    if (!exists) return fail(res, 'Edificio no encontrado.', 404);

    const b = req.body || {};
    const sets = [];
    const params = [];
    const addSet = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (b.nombre !== undefined) {
      if (!isNonEmptyString(b.nombre)) return fail(res, "Campo 'nombre' no puede quedar vacio.");
      addSet('nombre', cleanStr(b.nombre, 200));
    }
    if (b.descripcion !== undefined) addSet('descripcion', cleanStr(b.descripcion, 1000));
    if (b.direccion !== undefined) addSet('direccion', cleanStr(b.direccion, 300));
    if (b.foto_url !== undefined) addSet('foto_url', cleanStr(b.foto_url, 500));
    if (b.estado !== undefined) {
      if (!oneOf(b.estado, ESTADOS)) return fail(res, "Campo 'estado' invalido.");
      addSet('estado', b.estado);
    }
    if (b.atrapados_estimados !== undefined) {
      const n = toIntOrNull(b.atrapados_estimados);
      if (n === null || n < 0) return fail(res, "Campo 'atrapados_estimados' invalido.");
      addSet('atrapados_estimados', n);
    }
    if (b.lat !== undefined) {
      const la = toNumberOrNull(b.lat);
      if (la === null || la < -90 || la > 90) return fail(res, "Campo 'lat' invalido.");
      addSet('lat', la);
    }
    if (b.lng !== undefined) {
      const ln = toNumberOrNull(b.lng);
      if (ln === null || ln < -180 || ln > 180) return fail(res, "Campo 'lng' invalido.");
      addSet('lng', ln);
    }

    if (!sets.length) return fail(res, 'No hay campos para actualizar.');

    params.push(id);
    const { rows } = await query(
      `UPDATE edificios SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    return ok(res, rows[0], 'Edificio actualizado.');
  } catch (err) {
    next(err);
  }
});

export default router;

