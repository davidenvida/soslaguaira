import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { isNonEmptyString, cleanStr } from '../utils/validate.js';

const router = Router();

// POST /api/sugerencias  { texto, contacto }  -> publico, con anti-spam (writeLimiter).
router.post('/sugerencias', writeLimiter, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!isNonEmptyString(b.texto)) return fail(res, 'La sugerencia no puede estar vacia.');

    let pais = req.get('cf-ipcountry') || null;
    if (pais) pais = cleanStr(pais, 8);

    const { rows } = await query(
      'INSERT INTO sugerencias (texto, contacto, pais) VALUES ($1, $2, $3) RETURNING id',
      [cleanStr(b.texto, 2000), cleanStr(b.contacto, 200), pais]
    );
    return ok(res, { id: rows[0].id }, 'Gracias por tu sugerencia', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/sugerencias  -> admin: requiere X-Admin-Token == env ADMIN_TOKEN.
// Si ADMIN_TOKEN no esta seteado, el endpoint queda deshabilitado (nunca abierto).
router.get('/sugerencias', async (req, res, next) => {
  try {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) return fail(res, 'Endpoint admin deshabilitado (configurar ADMIN_TOKEN).', 403);
    if (req.get('x-admin-token') !== expected) return fail(res, 'No autorizado.', 401);

    const { rows } = await query(
      'SELECT id, texto, contacto, pais, created_at FROM sugerencias ORDER BY created_at DESC, id DESC'
    );
    return ok(res, rows, 'Listado de sugerencias.');
  } catch (err) {
    next(err);
  }
});

export default router;
