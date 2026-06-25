import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Prod (Railway): usa DATABASE_URL. Dev local: fallback a DB_HOST/PORT/NAME/USER/PASS.
const useConnString = !!process.env.DATABASE_URL;

// SSL: por defecto activo cuando hay DATABASE_URL (Railway via proxy publico exige SSL).
// Gaby puede forzarlo con DB_SSL=true/false (la red interna de Railway no usa SSL).
const sslEnabled = process.env.DB_SSL !== undefined
  ? process.env.DB_SSL === 'true'
  : useConnString;
const ssl = sslEnabled ? { rejectUnauthorized: false } : false;

const config = useConnString
  ? { connectionString: process.env.DATABASE_URL, ssl }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'sosven',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || '',
      ssl,
    };

export const pool = new Pool({ ...config, max: 10, idleTimeoutMillis: 30000 });

pool.on('error', (err) => {
  console.error('[db] Error inesperado en el pool de PostgreSQL:', err.message);
});

export const query = (text, params) => pool.query(text, params);
