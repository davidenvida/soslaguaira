import { Router } from 'express';
import { query } from '../db.js';
import { ok } from '../utils/response.js';
import { cleanStr } from '../utils/validate.js';

const router = Router();

// Cache en MEMORIA de geo-IP (la IP nunca se persiste; solo vive aqui de forma efimera).
const ipCache = new Map(); // ip -> { region, ciudad, operadora }
const IP_CACHE_MAX = 5000;

const esIpPrivada = (ip) =>
  !ip ||
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(ip) ||
  ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80') || ip === 'localhost';

// IP del cliente (Cloudflare o proxy). Se usa SOLO para geolocalizar; no se guarda.
const ipCliente = (req) => {
  const cf = req.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = req.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return (req.ip || '').replace(/^::ffff:/, '');
};

// Resuelve region/ciudad/operadora via ip-api.com (gratis, 45/min) con cache. Best-effort.
async function resolverGeo(ip) {
  const vacio = { region: null, ciudad: null, operadora: null };
  if (esIpPrivada(ip)) return vacio;
  if (ipCache.has(ip)) return ipCache.get(ip);

  let result = vacio;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,regionName,city,isp,org`,
      { signal: ctrl.signal }
    );
    clearTimeout(to);
    const d = await r.json();
    if (d.status === 'success') {
      result = {
        region: cleanStr(d.regionName, 120),
        ciudad: cleanStr(d.city, 120),
        operadora: cleanStr(d.isp || d.org, 160),
      };
    }
  } catch {
    /* timeout / rate-limit / red: queda en nulls, no se reintenta aqui */
  }
  if (ipCache.size >= IP_CACHE_MAX) ipCache.clear();
  ipCache.set(ip, result);
  return result;
}

// Dispositivo + navegador desde el user-agent (sin dependencias).
const parseUA = (ua = '') => {
  const s = ua.toLowerCase();
  let dispositivo = 'escritorio';
  if (/ipad|tablet|playbook|silk/.test(s)) dispositivo = 'tablet';
  else if (/mobi|android|iphone|ipod|phone/.test(s)) dispositivo = 'movil';

  let navegador = 'otro';
  if (/edg\//.test(s)) navegador = 'Edge';
  else if (/opr\/|opera/.test(s)) navegador = 'Opera';
  else if (/samsungbrowser/.test(s)) navegador = 'Samsung Internet';
  else if (/chrome\/|crios/.test(s)) navegador = 'Chrome';
  else if (/firefox\/|fxios/.test(s)) navegador = 'Firefox';
  else if (/safari\//.test(s)) navegador = 'Safari';
  return { dispositivo, navegador };
};

// Registro best-effort (corre DESPUES de responder 204; nunca afecta al cliente).
async function registrarVisita(req) {
  const b = req.body || {};
  let pais = req.get('cf-ipcountry') || null;
  if (pais) pais = cleanStr(pais, 8);
  const { dispositivo, navegador } = parseUA(req.get('user-agent'));
  const { region, ciudad, operadora } = await resolverGeo(ipCliente(req));

  await query(
    `INSERT INTO visitas (path, pais, referer, region, ciudad, operadora, dispositivo, navegador)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [cleanStr(b.path, 500), pais, cleanStr(b.referer, 500), region, ciudad, operadora, dispositivo, navegador]
  );
}

// POST /api/visita  { path, referer } -> beacon. Responde 204 YA; enriquece en background.
router.post('/visita', (req, res) => {
  res.status(204).end();
  registrarVisita(req).catch((err) => console.error('[visita] no se registro:', err.message));
});

// GET /api/visitas/resumen
router.get('/visitas/resumen', async (req, res, next) => {
  try {
    const [total, hoy, porDia, porPais, porPath, porHora, porDisp, porOperadora, porCiudad] = await Promise.all([
      query('SELECT count(*)::int AS n FROM visitas'),
      query("SELECT count(*)::int AS n FROM visitas WHERE created_at >= date_trunc('day', now())"),
      query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS dia, count(*)::int AS n
         FROM visitas WHERE created_at >= now() - interval '14 days' GROUP BY 1 ORDER BY 1`
      ),
      query("SELECT COALESCE(pais,'??') AS pais, count(*)::int AS n FROM visitas GROUP BY pais ORDER BY n DESC, pais LIMIT 10"),
      query("SELECT COALESCE(path,'(desconocido)') AS path, count(*)::int AS n FROM visitas GROUP BY path ORDER BY n DESC, path LIMIT 10"),
      query("SELECT EXTRACT(hour FROM created_at AT TIME ZONE 'America/Caracas')::int AS hora, count(*)::int AS n FROM visitas GROUP BY 1"),
      query("SELECT COALESCE(dispositivo,'(desconocido)') AS dispositivo, count(*)::int AS n FROM visitas GROUP BY dispositivo ORDER BY n DESC"),
      query("SELECT COALESCE(operadora,'(desconocida)') AS operadora, count(*)::int AS n FROM visitas WHERE operadora IS NOT NULL GROUP BY operadora ORDER BY n DESC LIMIT 10"),
      query("SELECT COALESCE(ciudad,'(desconocida)') AS ciudad, count(*)::int AS n FROM visitas WHERE ciudad IS NOT NULL GROUP BY ciudad ORDER BY n DESC LIMIT 10"),
    ]);

    // por_hora con las 24 horas siempre presentes (chart estable).
    const por_hora = Array.from({ length: 24 }, (_, h) => ({ hora: h, n: 0 }));
    for (const r of porHora.rows) if (r.hora >= 0 && r.hora < 24) por_hora[r.hora].n = r.n;

    const data = {
      total: total.rows[0].n,
      hoy: hoy.rows[0].n,
      por_dia: porDia.rows,
      por_pais: porPais.rows,
      por_path: porPath.rows,
      por_hora,
      por_dispositivo: porDisp.rows,
      por_operadora: porOperadora.rows,
      por_ciudad: porCiudad.rows,
    };
    return ok(res, data, 'Resumen de visitas.');
  } catch (err) {
    next(err);
  }
});

export default router;
