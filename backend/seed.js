// Carga datos semilla de La Guaira (seed_data_laguaira.json, autor: Fiona) en las tablas.
// El JSON ya viene adaptado al [MODELO DE DATOS] del contrato (campos y enums exactos),
// por lo que la insercion es directa. Recarga idempotente: TRUNCATE + insert.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(__dirname, '..', 'seed_data_laguaira.json');

// Cadena vacia -> null (mantiene las columnas opcionales limpias).
const nn = (v) => (v === '' || v === undefined ? null : v);

async function seed() {
  const raw = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE personas, atrapados, edificios, confirmaciones RESTART IDENTITY CASCADE');

    for (const p of raw.personas) {
      await client.query(
        `INSERT INTO personas
           (tipo, nombre, edad, descripcion, foto_url, estado, lat, lng, direccion, edificio, piso, contacto_nombre, contacto_telefono)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          p.tipo, p.nombre, nn(p.edad), nn(p.descripcion), nn(p.foto_url), p.estado,
          nn(p.lat), nn(p.lng), nn(p.direccion), nn(p.edificio), nn(p.piso),
          nn(p.contacto_nombre), nn(p.contacto_telefono),
        ]
      );
    }

    for (const a of raw.atrapados) {
      await client.query(
        `INSERT INTO atrapados
           (cantidad_personas, edificio, piso, lat, lng, direccion, estado, descripcion, foto_url, contacto)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          nn(a.cantidad_personas) ?? 1, nn(a.edificio), nn(a.piso), nn(a.lat), nn(a.lng),
          nn(a.direccion), a.estado, nn(a.descripcion), nn(a.foto_url), nn(a.contacto),
        ]
      );
    }

    for (const e of raw.edificios) {
      await client.query(
        `INSERT INTO edificios
           (nombre, lat, lng, direccion, estado, atrapados_estimados, descripcion, foto_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          e.nombre, nn(e.lat), nn(e.lng), nn(e.direccion), e.estado,
          nn(e.atrapados_estimados) ?? 0, nn(e.descripcion), nn(e.foto_url),
        ]
      );
    }

    await client.query('COMMIT');

    const counts = await client.query(
      `SELECT (SELECT count(*) FROM personas) personas,
              (SELECT count(*) FROM atrapados) atrapados,
              (SELECT count(*) FROM edificios) edificios`
    );
    const c = counts.rows[0];
    console.log(`[seed] cargado: ${c.personas} personas, ${c.atrapados} atrapados, ${c.edificios} edificios.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('[seed] ERROR:', err.message);
  process.exit(1);
});
