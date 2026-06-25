import { Router } from 'express';
import { pool, query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { isNonEmptyString, cleanStr, toIntOrNull } from '../utils/validate.js';

const router = Router();

// Acepta un objeto, un array, o { items: [...] }.
const toItems = (b) => {
  if (Array.isArray(b)) return b;
  if (b && Array.isArray(b.items)) return b.items;
  if (b && typeof b === 'object') return [b];
  return [];
};

// Inserta voluntarios validados (nombre + contacto obligatorios). Exito parcial.
async function insertarVoluntarios(items) {
  const valid = [];
  const rejected = [];
  items.forEach((raw, i) => {
    const it = raw || {};
    if (!isNonEmptyString(it.nombre)) rejected.push({ index: i, reason: 'nombre es obligatorio', item: raw });
    else if (!isNonEmptyString(it.contacto)) rejected.push({ index: i, reason: 'contacto es obligatorio', item: raw });
    else valid.push(it);
  });

  const ids = [];
  if (valid.length) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const it of valid) {
        const r = await client.query(
          `INSERT INTO voluntarios (nombre, contacto, zona, tipo_ayuda, disponibilidad, fuente_url, notas)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [
            cleanStr(it.nombre, 160), cleanStr(it.contacto, 200), cleanStr(it.zona, 120),
            cleanStr(it.tipo_ayuda, 40), cleanStr(it.disponibilidad, 200),
            cleanStr(it.fuente_url, 500), cleanStr(it.notas, 1000),
          ]
        );
        ids.push(r.rows[0].id);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  return { inserted: ids.length, ids, rejected };
}

// POST /api/voluntarios  y  POST /api/voluntarios/bulk
// Aceptan single | array | {items:[...]}. Publico (registro) + bulk (carga de la asistente).
const postHandler = async (req, res, next) => {
  try {
    const items = toItems(req.body);
    if (!items.length) return fail(res, 'No se recibieron voluntarios.');
    const r = await insertarVoluntarios(items);
    return ok(res, r, `${r.inserted} registrado(s), ${r.rejected.length} rechazado(s).`, 201);
  } catch (err) {
    next(err);
  }
};
router.post('/', writeLimiter, postHandler);
router.post('/bulk', writeLimiter, postHandler);

// GET /api/voluntarios?q=&zona=&tipo=&page=&limit=  (publico, paginado)
router.get('/', async (req, res, next) => {
  try {
    const { q, zona, tipo } = req.query;
    const conds = [];
    const params = [];
    if (zona && String(zona).trim()) { params.push(`%${zona.trim()}%`); conds.push(`zona ILIKE $${params.length}`); }
    if (tipo && String(tipo).trim()) { params.push(`%${tipo.trim()}%`); conds.push(`tipo_ayuda ILIKE $${params.length}`); }
    if (q && String(q).trim()) {
      params.push(`%${q.trim()}%`);
      conds.push(`(nombre ILIKE $${params.length} OR notas ILIKE $${params.length} OR zona ILIKE $${params.length})`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const total = Number((await query(`SELECT count(*)::int AS c FROM voluntarios ${where}`, params)).rows[0].c);

    const limRaw = toIntOrNull(req.query.limit);
    const pageRaw = toIntOrNull(req.query.page);
    const offRaw = toIntOrNull(req.query.offset);
    const limit = limRaw === null ? 60 : Math.min(Math.max(limRaw, 1), 500);
    const offset = offRaw !== null ? Math.max(offRaw, 0) : (pageRaw !== null ? Math.max(pageRaw - 1, 0) * limit : 0);

    const pageParams = [...params, limit, offset];
    const { rows } = await query(
      `SELECT * FROM voluntarios ${where} ORDER BY created_at DESC, id DESC
       LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
      pageParams
    );
    return ok(res, {
      items: rows, total, limit, offset,
      page: Math.floor(offset / limit) + 1, pages: Math.max(1, Math.ceil(total / limit)),
    }, `Voluntarios (${rows.length} de ${total}).`);
  } catch (err) {
    next(err);
  }
});

export default router;
