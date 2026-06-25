import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { oneOf, cleanStr, toIntOrNull, validCoords } from '../utils/validate.js';
import { buildGeocoder } from '../utils/geocode.js';

const router = Router();

const ESTADOS = ['atrapado', 'en_rescate', 'rescatado', 'fallecido'];

// Extrae "piso N" de un texto libre, si aparece.
const extraerPiso = (txt) => {
  const m = /\bpiso\s+([\w-]+)/i.exec(txt || '');
  return m ? m[1] : null;
};

// Normaliza una fila de personas_intel (estado='atrapado') al shape de la card de rescate.
const intelAtrapadoToCard = (r) => ({
  id: `intel-${r.id}`,
  cantidad_personas: null,
  edificio: r.sector_o_edificio,
  piso: extraerPiso(r.descripcion),
  lat: r.lat,
  lng: r.lng,
  direccion: r.ultima_ubicacion,
  estado: 'atrapado',
  descripcion: r.descripcion,
  contacto: r.contacto,
  foto_url: r.foto_url,
  fuente_url: r.fuente_url,
  created_at: r.created_at,
  origen: 'intel',
});

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
// UNION: incluye los personas_intel con estado='atrapado' y ubicacion (lat/lng directos o
// geocodificables), normalizados al shape de la card -> el panel de rescate los muestra sin
// cambios de frontend. id = 'intel-<id>', origen = 'intel'.
router.get('/', async (req, res, next) => {
  try {
    const { estado } = req.query;
    if (estado && !oneOf(estado, ESTADOS)) return fail(res, "Filtro 'estado' invalido.");

    // 1) Atrapados nativos (tabla de la app).
    const nativeParams = [];
    let nativeWhere = '';
    if (estado) { nativeParams.push(estado); nativeWhere = `WHERE estado = $1`; }
    const nativos = (await query(`SELECT * FROM atrapados ${nativeWhere}`, nativeParams)).rows
      .map((r) => ({ ...r, origen: 'app' }));

    // 2) Intel con estado='atrapado' + ubicacion (a menos que el filtro pida otro estado).
    let intelCards = [];
    if (!estado || estado === 'atrapado') {
      const intel = (await query(
        `SELECT id, sector_o_edificio, descripcion, ultima_ubicacion, contacto, foto_url,
                fuente_url, created_at, lat, lng, parroquia
         FROM personas_intel
         WHERE estado = 'atrapado' AND duplicate_of IS NULL`
      )).rows;
      const gaz = (await query('SELECT nombre, parroquia, lat, lon FROM residencias')).rows;
      const geocode = buildGeocoder(gaz);
      intelCards = intel
        .map((r) => (r.lat != null && r.lng != null) ? r : { ...r, ...geocode(r) })
        .filter((r) => r.lat != null && r.lng != null) // solo los ubicables van al mapa de rescate
        .map(intelAtrapadoToCard);
    }

    // 3) Merge + orden de urgencia (atrapado primero, luego mas reciente).
    const merged = [...nativos, ...intelCards].sort((a, b) => {
      const ua = a.estado === 'atrapado' ? 0 : 1;
      const ub = b.estado === 'atrapado' ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return ok(res, merged, 'Listado de atrapados (priorizado, app + intel).');
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
