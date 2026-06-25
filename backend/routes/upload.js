import { Router } from 'express';
import { ok, fail } from '../utils/response.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// POST /api/upload  (multipart, campo 'foto') -> { success, data:{ url } }
router.post('/', uploadLimiter, upload.single('foto'), (req, res) => {
  if (!req.file) return fail(res, "No se recibio ningun archivo en el campo 'foto'.");
  return ok(res, { url: `/uploads/${req.file.filename}` }, 'Archivo subido.', 201);
});

export default router;
