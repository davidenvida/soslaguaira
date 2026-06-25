import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { oneOf, toIntOrNull } from '../utils/validate.js';

const router = Router();

const VOTOS = ['confirmo', 'desmiento'];
// tipo_reporte (singular) -> tabla destino
const TIPO_TABLA = { persona: 'personas', atrapado: 'atrapados', edificio: 'edificios' };

// POST /api/:tipo/:id/confirmar   body { voto }
router.post('/:tipo/:id/confirmar', writeLimiter, async (req, res, next) => {
  try {
    const { tipo } = req.params;
    const tabla = TIPO_TABLA[tipo];
    if (!tabla) return fail(res, "Parametro 'tipo' invalido (persona|atrapado|edificio).");

    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');

    const voto = (req.body || {}).voto;
    if (!oneOf(voto, VOTOS)) return fail(res, "Campo 'voto' invalido (confirmo|desmiento).");

    // El reporte debe existir antes de votar.
    const exists = await query(`SELECT 1 FROM ${tabla} WHERE id = $1`, [id]);
    if (!exists.rows.length) return fail(res, 'El reporte referenciado no existe.', 404);

    await query(
      'INSERT INTO confirmaciones (tipo_reporte, reporte_id, voto) VALUES ($1,$2,$3)',
      [tipo, id, voto]
    );

    // Devuelve el conteo agregado de votos para ese reporte.
    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE voto = 'confirmo')  AS confirmo,
         COUNT(*) FILTER (WHERE voto = 'desmiento') AS desmiento
       FROM confirmaciones WHERE tipo_reporte = $1 AND reporte_id = $2`,
      [tipo, id]
    );
    const data = {
      tipo,
      reporte_id: id,
      confirmo: Number(rows[0].confirmo),
      desmiento: Number(rows[0].desmiento),
    };
    return ok(res, data, 'Voto registrado.', 201);
  } catch (err) {
    next(err);
  }
});

export default router;
