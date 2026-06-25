import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { isNonEmptyString, cleanStr } from '../utils/validate.js';
import { adminGate } from '../middleware/adminGate.js';

const router = Router();

// POST /api/errores  { texto, contacto }  -> publico, con anti-spam (writeLimiter).
router.post('/errores', writeLimiter, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!isNonEmptyString(b.texto)) return fail(res, 'El reporte de error no puede estar vacio.');

    let pais = req.get('cf-ipcountry') || null;
    if (pais) pais = cleanStr(pais, 8);

    const { rows } = await query(
      'INSERT INTO errores (texto, contacto, pais) VALUES ($1, $2, $3) RETURNING id',
      [cleanStr(b.texto, 2000), cleanStr(b.contacto, 200), pais]
    );
    return ok(res, { id: rows[0].id }, 'Gracias por reportar el error', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/errores  -> admin (X-Admin-Token), para verlos en /stats.
router.get('/errores', adminGate, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, texto, contacto, pais, created_at FROM errores ORDER BY created_at DESC, id DESC'
    );
    return ok(res, rows, 'Reportes de error.');
  } catch (err) {
    next(err);
  }
});

export default router;
