import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import {
  isNonEmptyString, oneOf, cleanStr, toIntOrNull, validCoords,
} from '../utils/validate.js';
import { matchScore } from '../utils/match.js';

const router = Router();

const TIPOS = ['busco', 'reporto'];
const ESTADOS = ['desaparecido', 'a_salvo', 'herido', 'visto_con_vida', 'fallecido', 'desconocido'];

// Contrato: JSON snake_case espejo de columnas, en input y output.

// POST /api/personas
router.post('/', writeLimiter, async (req, res, next) => {
  try {
    const b = req.body || {};

    if (!oneOf(b.tipo, TIPOS)) return fail(res, "Campo 'tipo' invalido (busco|reporto).");
    if (!isNonEmptyString(b.nombre)) return fail(res, "Campo 'nombre' es obligatorio.");
    const estado = b.estado === undefined ? 'desconocido' : b.estado;
    if (!oneOf(estado, ESTADOS)) return fail(res, "Campo 'estado' invalido.");

    const coords = validCoords(b.lat, b.lng);

    const sql = `
      INSERT INTO personas
        (tipo, nombre, edad, descripcion, foto_url, estado, lat, lng, direccion, edificio, piso, contacto_nombre, contacto_telefono)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`;
    const params = [
      b.tipo,
      cleanStr(b.nombre, 120),
      toIntOrNull(b.edad),
      cleanStr(b.descripcion, 1000),
      cleanStr(b.foto_url, 300),
      estado,
      coords ? coords.lat : null,
      coords ? coords.lng : null,
      cleanStr(b.direccion, 300),
      cleanStr(b.edificio, 200),
      cleanStr(b.piso, 50),
      cleanStr(b.contacto_nombre, 120),
      cleanStr(b.contacto_telefono, 50),
    ];
    const { rows } = await query(sql, params);
    return ok(res, rows[0], 'Persona registrada.', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/personas?estado=&q=&tipo=
router.get('/', async (req, res, next) => {
  try {
    const { estado, q, tipo } = req.query;
    const conds = [];
    const params = [];

    if (estado) {
      if (!oneOf(estado, ESTADOS)) return fail(res, "Filtro 'estado' invalido.");
      params.push(estado);
      conds.push(`estado = $${params.length}`);
    }
    if (tipo) {
      if (!oneOf(tipo, TIPOS)) return fail(res, "Filtro 'tipo' invalido.");
      params.push(tipo);
      conds.push(`tipo = $${params.length}`);
    }
    if (q && String(q).trim()) {
      params.push(`%${String(q).trim()}%`);
      conds.push(`(nombre ILIKE $${params.length} OR descripcion ILIKE $${params.length})`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await query(`SELECT * FROM personas ${where} ORDER BY created_at DESC`, params);
    return ok(res, rows, 'Listado de personas.');
  } catch (err) {
    next(err);
  }
});

// GET /api/personas/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');
    const { rows } = await query('SELECT * FROM personas WHERE id = $1', [id]);
    if (!rows.length) return fail(res, 'Persona no encontrada.', 404);
    return ok(res, rows[0], 'Persona encontrada.');
  } catch (err) {
    next(err);
  }
});

// GET /api/personas/:id/match  -> coincidencias por nombre fuzzy + cercania
router.get('/:id/match', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');

    const base = (await query('SELECT * FROM personas WHERE id = $1', [id])).rows[0];
    if (!base) return fail(res, 'Persona no encontrada.', 404);

    // Si busco -> matcheo contra reportes (reporto); si reporto -> contra busquedas (busco).
    const targetTipo = base.tipo === 'busco' ? 'reporto' : 'busco';
    const candidates = (await query('SELECT * FROM personas WHERE tipo = $1', [targetTipo])).rows;

    const MIN_SCORE = 0.35;
    const matches = candidates
      .map((c) => {
        const { score, nameSimilarity, distanceMeters } = matchScore(base, c);
        // Campos calculados tambien en snake_case (espejo del contrato).
        return { ...c, match_score: score, name_similarity: nameSimilarity, distance_meters: distanceMeters };
      })
      .filter((c) => c.match_score >= MIN_SCORE)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 20);

    // data = array crudo de coincidencias (consistente con los demas GET y con MatchView).
    return ok(res, matches, `${matches.length} coincidencia(s).`);
  } catch (err) {
    next(err);
  }
});

export default router;
