import rateLimit from 'express-rate-limit';

// Limite general para lectura/navegacion.
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, message: 'Demasiadas solicitudes, intenta en un momento.' },
});

// Limite mas estricto para escritura (POST/PATCH) y uploads, para evitar spam.
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, message: 'Demasiados reportes seguidos, espera un momento.' },
});

// Limite laxo para ingesta de intel (/api/intel): las asistentes cargan en rafaga,
// son internas confiables. Solo es un backstop anti-runaway, no debe ahogar el batch.
export const intelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, message: 'Ingesta por encima del backstop, reintenta en un momento.' },
});

// Limite laxo para uploads (/api/upload): re-hosteo masivo de imagenes (IG/web).
// Backstop anti-runaway, no debe ahogar la subida en lote.
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, message: 'Subida por encima del backstop, reintenta en un momento.' },
});
