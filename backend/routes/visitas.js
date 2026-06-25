import { Router } from 'express';
import { query } from '../db.js';
import { ok } from '../utils/response.js';
import { cleanStr } from '../utils/validate.js';

const router = Router();

// POST /api/visita  { path, referer }  -> beacon. Privacidad: sin IP, sin cookies.
// 'pais' del header CF-IPCountry si viene. NUNCA falla al cliente (responde 204 igual).
router.post('/visita', async (req, res) => {
  try {
    const b = req.body || {};
    let pais = req.get('cf-ipcountry') || null;
    if (pais) pais = cleanStr(pais, 8); // ej 'VE', 'US', 'XX'
    await query(
      'INSERT INTO visitas (path, pais, referer) VALUES ($1, $2, $3)',
      [cleanStr(b.path, 500), pais, cleanStr(b.referer, 500)]
    );
  } catch (err) {
    console.error('[visita] no se registro:', err.message); // no propagar al cliente
  }
  return res.status(204).end();
});

// GET /api/visitas/resumen
router.get('/visitas/resumen', async (req, res, next) => {
  try {
    const [total, hoy, porDia, porPais, porPath] = await Promise.all([
      query('SELECT count(*)::int AS n FROM visitas'),
      query("SELECT count(*)::int AS n FROM visitas WHERE created_at >= date_trunc('day', now())"),
      query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS dia, count(*)::int AS n
         FROM visitas WHERE created_at >= now() - interval '14 days'
         GROUP BY 1 ORDER BY 1`
      ),
      query(
        `SELECT COALESCE(pais, '??') AS pais, count(*)::int AS n
         FROM visitas GROUP BY pais ORDER BY n DESC, pais LIMIT 10`
      ),
      query(
        `SELECT COALESCE(path, '(desconocido)') AS path, count(*)::int AS n
         FROM visitas GROUP BY path ORDER BY n DESC, path LIMIT 10`
      ),
    ]);

    const data = {
      total: total.rows[0].n,
      hoy: hoy.rows[0].n,
      por_dia: porDia.rows,
      por_pais: porPais.rows,
      por_path: porPath.rows,
    };
    return ok(res, data, 'Resumen de visitas.');
  } catch (err) {
    next(err);
  }
});

export default router;
