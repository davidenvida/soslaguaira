// Genera backend/exports/real_data.sql con SOLO la data REAL para produccion (Railway).
// NO incluye el seed sintetico (personas/atrapados, edificios 1-10). Va:
//   - personas_intel (todas, reales: cargadas por las asistentes/OSINT)
//   - residencias (todas, reales: CSV de Valentina)
//   - edificios REALES (los que NO son del seed sintetico de Fiona)
// INSERTs idempotentes (ON CONFLICT DO NOTHING) + setval de secuencias.
// Las tablas personas/atrapados/edificios(sinteticos) arrancan VACIAS en prod.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'exports');
const OUT_FILE = path.join(OUT_DIR, 'real_data.sql');

// Discriminador real vs sintetico (definido por Bruno/Hugo): los edificios REALES tienen
// 'Fuente:' en la descripcion (reportaven, cargado por Hugo); el seed sintetico (ids 1-10) no.
const EDIFICIOS_REALES_SQL = "SELECT * FROM edificios WHERE descripcion LIKE '%Fuente:%' ORDER BY id";

// Serializa un valor JS a literal SQL seguro.
const lit = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

// Genera los INSERT de una tabla a partir de filas. Omite columnas en 'skip'.
const insertsFor = (table, rows, skip = []) => {
  if (!rows.length) return `-- ${table}: 0 filas reales\n`;
  const cols = Object.keys(rows[0]).filter((c) => !skip.includes(c));
  const lines = rows.map((r) => {
    const vals = cols.map((c) => lit(r[c])).join(', ');
    return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals}) ON CONFLICT DO NOTHING;`;
  });
  return `-- ${table}: ${rows.length} fila(s)\n${lines.join('\n')}\n`;
};

const setval = (table) =>
  `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}));`;

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const residencias = (await pool.query('SELECT * FROM residencias ORDER BY id')).rows;
  const personasIntel = (await pool.query('SELECT * FROM personas_intel ORDER BY id')).rows;
  const edificiosReales = (await pool.query(EDIFICIOS_REALES_SQL)).rows;

  const parts = [];
  parts.push('-- real_data.sql — SOLO data REAL para produccion (SOS La Guaira).');
  parts.push('-- Generado por backend/export_real_data.js. Cargar DESPUES de migrar (001..009).');
  parts.push('-- NO contiene el seed sintetico (personas/atrapados/edificios de demo).');
  parts.push('BEGIN;');
  parts.push('');

  // residencias (FK ninguna)
  parts.push(insertsFor('residencias', residencias));
  // personas_intel: insertamos sin duplicate_of (FK self) y lo aplicamos despues por UPDATE.
  parts.push(insertsFor('personas_intel', personasIntel, ['duplicate_of']));
  // edificios reales
  parts.push(insertsFor('edificios', edificiosReales));
  parts.push('');

  // Segundo pase: duplicate_of (ya existen todas las filas referenciadas).
  const conDup = personasIntel.filter((r) => r.duplicate_of !== null && r.duplicate_of !== undefined);
  if (conDup.length) {
    parts.push('-- duplicate_of (merge cross-fuente), aplicado tras insertar todas las filas');
    for (const r of conDup) {
      parts.push(`UPDATE personas_intel SET duplicate_of = ${r.duplicate_of} WHERE id = ${r.id};`);
    }
    parts.push('');
  }

  // Ajuste de secuencias para que los proximos INSERT en vivo no choquen.
  parts.push('-- secuencias');
  parts.push(setval('residencias'));
  parts.push(setval('personas_intel'));
  parts.push(setval('edificios'));
  parts.push('');
  parts.push('COMMIT;');
  parts.push('');

  fs.writeFileSync(OUT_FILE, parts.join('\n'), 'utf8');
  console.log(`[export] ${OUT_FILE}`);
  console.log(`[export] residencias=${residencias.length}, personas_intel=${personasIntel.length}, edificios_reales=${edificiosReales.length}, duplicate_of=${conDup.length}`);
  await pool.end();
}

run().catch((err) => {
  console.error('[export] ERROR:', err.message);
  process.exit(1);
});
