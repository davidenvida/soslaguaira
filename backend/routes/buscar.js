import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { buscarEnReportes, buscarEnHospitales } from '../utils/busqueda.js';

const router = Router();

// GET /api/buscar?q=<nombre|cedula> -> busqueda UNIFICADA: directorio de reportes + listas de hospital.
// Una familia busca a su desaparecido y lo encuentra este reportado O ingresado en un hospital.
// Fallecidos quedan fuera (privados).
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return fail(res, "Parametro 'q' requerido (nombre o cedula).");

    const [reportes, hospitales] = await Promise.all([
      buscarEnReportes(query, q),
      buscarEnHospitales(query, q, 'todos'),
    ]);

    return ok(
      res,
      { reportes, hospitales, total: reportes.length + hospitales.length },
      `${reportes.length} en reportes, ${hospitales.length} en hospitales.`
    );
  } catch (err) {
    next(err);
  }
});

export default router;
