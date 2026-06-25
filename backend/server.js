import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { pool } from './db.js';
import { ok } from './utils/response.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

import personasRouter from './routes/personas.js';
import atrapadosRouter from './routes/atrapados.js';
import edificiosRouter from './routes/edificios.js';
import uploadRouter from './routes/upload.js';
import confirmacionesRouter from './routes/confirmaciones.js';
import intelRouter from './routes/intel.js';
import visitasRouter from './routes/visitas.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
// CORS_ORIGIN acepta uno o varios origenes separados por coma (ej dominio + URL de Railway).
const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Seguridad. crossOriginResourcePolicy permisivo para servir /uploads al frontend.
// img-src permite https: (fotos externas de X/IG/web) ademas de las re-hosteadas en /uploads.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    },
  },
}));
app.use(cors({ origin: CORS_ORIGINS, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] }));
app.use(express.json({ limit: '5mb' })); // batches de ingesta de intel
app.use(express.urlencoded({ extended: true }));

// El limiter general no debe ahogar la ingesta de intel ni el re-hosteo masivo de imagenes
// (rafagas internas confiables). /api/intel y /api/upload tienen su propio limiter laxo.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/intel') || req.path.startsWith('/api/upload') || req.path === '/api/visita') return next();
  return generalLimiter(req, res, next);
});

// Archivos subidos (publicos).
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Healthcheck.
app.get('/api/health', (req, res) => ok(res, { status: 'up' }, 'Backend SOS La Guaira operativo.'));

// Rutas de la API.
app.use('/api/personas', personasRouter);
app.use('/api/atrapados', atrapadosRouter);
app.use('/api/edificios', edificiosRouter);
app.use('/api/upload', uploadRouter); // incluye POST /api/upload/import (temporal, token-gated)
app.use('/api/intel', intelRouter);
app.use('/api', visitasRouter); // POST /api/visita, GET /api/visitas/resumen
app.use('/api', confirmacionesRouter); // POST /api/:tipo/:id/confirmar

// 404 + manejador de errores (siempre al final).
app.use(notFound);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`[server] SOS La Guaira backend escuchando en http://localhost:${PORT}`);
  console.log(`[server] CORS permitido para ${CORS_ORIGINS.join(', ')}`);
});

// Cierre limpio.
const shutdown = async () => {
  console.log('\n[server] cerrando...');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
