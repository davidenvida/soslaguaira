// Transfiere los archivos de backend/uploads del DEV al Volume de PROD, conservando el
// nombre EXACTO (para que las foto_url cargadas matcheen). Usa el endpoint temporal
// POST /api/upload-import (token-gated por IMPORT_TOKEN).
//
// Uso (desde backend/, en el DEV):
//   TARGET_URL=https://backend-production-xxxx.up.railway.app IMPORT_TOKEN=elsecreto node import_uploads_to_prod.js
// Opcional: pasar el dir como primer arg (default ./uploads).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.argv[2] || path.join(__dirname, 'uploads');
const TARGET = (process.env.TARGET_URL || '').replace(/\/$/, '');
const TOKEN = process.env.IMPORT_TOKEN;

if (!TARGET || !TOKEN) {
  console.error('Faltan TARGET_URL y/o IMPORT_TOKEN en el entorno.');
  process.exit(1);
}

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

async function run() {
  const files = fs.readdirSync(DIR).filter((f) => ALLOWED.has(path.extname(f).toLowerCase()));
  console.log(`[import] ${files.length} archivo(s) en ${DIR} -> ${TARGET}`);

  let ok = 0;
  let failed = 0;
  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    const buf = fs.readFileSync(path.join(DIR, name));
    const fd = new FormData();
    fd.append('foto', new Blob([buf], { type: MIME[ext] }), name);
    try {
      const res = await fetch(`${TARGET}/api/upload-import?token=${encodeURIComponent(TOKEN)}`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        ok++;
        console.log(`  OK  ${name}`);
      } else {
        failed++;
        console.log(`  ERR ${name} -> ${res.status} ${json.message || ''}`);
      }
    } catch (err) {
      failed++;
      console.log(`  ERR ${name} -> ${err.message}`);
    }
  }
  console.log(`[import] listo: ${ok} subidos, ${failed} fallidos.`);
}

run().catch((e) => { console.error('[import] ERROR:', e.message); process.exit(1); });
