// Script base para el benchmark del modulo de listas manuscritas.
// Llama a POST /api/listas/interpretar y muestra la transcripcion + coincidencias.
// Hugo: extender con la comparacion vs ground-truth (precision/recall por campo).
//
// Uso:
//   node test_listas.js --url https://.../lista.jpg
//   node test_listas.js --file ./lista.jpg
//   node test_listas.js --url https://.../lista.jpg --instrucciones "prompt a iterar"
//   TARGET=https://api.soslaguaira.lat node test_listas.js --url ...
import fs from 'fs';
import path from 'path';

const TARGET = (process.env.TARGET || 'http://localhost:3000').replace(/\/$/, '');
const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

const url = get('--url');
const file = get('--file');
const instrucciones = get('--instrucciones') || undefined;
const tipo = get('--tipo') || undefined;

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

async function run() {
  const body = { instrucciones, tipo };
  if (url) {
    body.image_url = url;
  } else if (file) {
    const ext = path.extname(file).toLowerCase();
    body.image_base64 = fs.readFileSync(file).toString('base64');
    body.mime = MIME[ext] || 'image/jpeg';
  } else {
    console.error('Falta --url <imagen> o --file <ruta>'); process.exit(1);
  }

  const t0 = Date.now();
  const r = await fetch(`${TARGET}/api/listas/interpretar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  console.log(`HTTP ${r.status} (${Date.now() - t0} ms)`);
  if (!json.success) { console.log('ERROR:', json.message); return; }

  const personas = json.data.personas || [];
  console.log(`Transcritas: ${personas.length}\n`);
  for (const p of personas) {
    const her = p.estado_heredado ? ' (heredado)' : '';
    console.log(`- ${p.nombre} [${p.estado}${her}] ${p.detalle || ''} ${p.lugar ? '@ ' + p.lugar : ''}`);
    for (const c of (p.coincidencias || [])) {
      console.log(`    match: #${c.id} ${c.nombre_completo} (${c.estado}) score=${c.score}`);
    }
  }
}

run().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
