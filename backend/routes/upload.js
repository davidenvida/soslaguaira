import { Router } from 'express';
import { ok, fail } from '../utils/response.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { upload, uploadImport } from '../middleware/upload.js';

const router = Router();

// POST /api/upload  (multipart, campo 'foto') -> { success, data:{ url } }
router.post('/', uploadLimiter, upload.single('foto'), (req, res) => {
  if (!req.file) return fail(res, "No se recibio ningun archivo en el campo 'foto'.");
  return ok(res, { url: `/uploads/${req.file.filename}` }, 'Archivo subido.', 201);
});

// POST /api/upload/import  (TEMPORAL) -> transfiere uploads del dev al Volume de prod.
// Conserva el filename ORIGINAL (para que las foto_url existentes matcheen).
// Auth: header X-Import-Token vs process.env.IMPORT_TOKEN.
// Kill-switch: si IMPORT_TOKEN no esta seteado, el endpoint queda deshabilitado (404).
// Hereda la exencion del rate-limiter general por estar bajo /api/upload.
const importTokenGate = (req, res, next) => {
  const expected = process.env.IMPORT_TOKEN;
  if (!expected) return fail(res, 'Import deshabilitado.', 404);
  const given = req.get('x-import-token') || req.query.token;
  if (given !== expected) return fail(res, 'Token de import invalido.', 403);
  return next();
};

router.post('/import', uploadLimiter, importTokenGate, uploadImport.single('foto'), (req, res) => {
  if (!req.file) return fail(res, "No se recibio ningun archivo en el campo 'foto'.");
  return ok(res, { url: `/uploads/${req.file.filename}` }, 'Archivo importado.', 201);
});

export default router;
