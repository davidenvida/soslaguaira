// Sync one-time dev -> prod de personas_intel via la API (POST es dedup-safe por
// (nombre_completo, fuente_url): inserta los nuevos y enriquece los existentes).
// Uso: TARGET_URL=https://backend-production-xxxx.up.railway.app node sync_dev_to_prod.js
import { pool } from './db.js';

const TARGET = (process.env.TARGET_URL || '').replace(/\/$/, '');
if (!TARGET) { console.error('Falta TARGET_URL'); process.exit(1); }

async function run() {
  const rows = (await pool.query(
    `SELECT nombre_completo, edad, estado, ultima_ubicacion, parroquia, sector_o_edificio,
            descripcion, foto_url, reportante, relacion, contacto, fuente_url, fecha_reporte,
            notas, origen, lat, lng
     FROM personas_intel WHERE duplicate_of IS NULL ORDER BY id`
  )).rows;

  // fecha_reporte (Date) -> ISO para preservar el momento del reporte.
  const payload = rows.map((r) => ({ ...r, fecha_reporte: r.fecha_reporte ? r.fecha_reporte.toISOString() : null }));

  console.log(`[sync] enviando ${payload.length} filas a ${TARGET}`);
  const res = await fetch(`${TARGET}/api/intel/personas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  console.log('[sync] status', res.status, JSON.stringify(json.data || json, null, 2).slice(0, 500));
  await pool.end();
}

run().catch((e) => { console.error('[sync] ERROR:', e.message); process.exit(1); });
