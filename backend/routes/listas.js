import { Router } from 'express';
import multer from 'multer';
import { query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { cleanStr, isNonEmptyString } from '../utils/validate.js';
import { nameSimilarity } from '../utils/match.js';

const router = Router();

// Imagen en memoria (no se persiste): se manda a GPT y se descarta.
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

// Prompt base (Hugo afina el prompt/benchmark; se puede sobreescribir con body.instrucciones).
const SYSTEM_PROMPT = `Eres un transcriptor de listas MANUSCRITAS de emergencia (ingresos a hospitales, fallecidos, heridos) tras un desastre en La Guaira, Venezuela.
Transcribe EXACTAMENTE lo que ves, sin inventar ni completar nombres. Si algo es ilegible, marcalo en 'detalle'.
Devuelve SOLO un JSON con esta forma exacta:
{"personas":[{"nombre":"<nombre completo tal cual>","estado":"ingresado|fallecido|herido|desconocido","detalle":"<edad/notas/ilegible si aplica>","lugar":"<hospital o sector si aparece, si no vacio>"}]}
Usa 'desconocido' para estado si la lista no lo indica. No agregues texto fuera del JSON.`;

// Llama a GPT-4o con vision y devuelve el array de personas transcritas.
async function interpretarConGPT(imageUrl, instrucciones) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { const e = new Error('OPENAI_API_KEY no configurada en el backend.'); e.status = 503; throw e; }

  const body = {
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: instrucciones || 'Transcribe esta lista manuscrita a JSON segun el formato indicado.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
  };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    const e = new Error(`OpenAI ${r.status}: ${t.slice(0, 300)}`);
    e.status = 502;
    throw e;
  }
  const data = await r.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  let parsed;
  try { parsed = JSON.parse(content); } catch { parsed = { personas: [] }; }
  return Array.isArray(parsed.personas) ? parsed.personas : [];
}

// Match de los nombres transcritos contra personas_intel (fuzzy por nombre normalizado).
async function matchContraDirectorio(personas) {
  if (!personas.length) return personas;
  const dir = (await query(
    'SELECT id, nombre_completo, estado, parroquia FROM personas_intel WHERE duplicate_of IS NULL'
  )).rows;
  return personas.map((p) => {
    const coincidencias = dir
      .map((r) => ({
        id: r.id, nombre_completo: r.nombre_completo, estado: r.estado, parroquia: r.parroquia,
        score: Number(nameSimilarity(p.nombre, r.nombre_completo).toFixed(3)),
      }))
      .filter((c) => c.score >= 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return { ...p, coincidencias };
  });
}

// POST /api/listas/interpretar  (multipart 'foto' | { image_url } | { image_base64, mime })
router.post('/interpretar', writeLimiter, memUpload.single('foto'), async (req, res, next) => {
  try {
    const b = req.body || {};
    let imageUrl;
    if (req.file) {
      imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    } else if (isNonEmptyString(b.image_url)) {
      imageUrl = b.image_url.trim();
    } else if (isNonEmptyString(b.image_base64)) {
      imageUrl = b.image_base64.startsWith('data:')
        ? b.image_base64
        : `data:${b.mime || 'image/jpeg'};base64,${b.image_base64}`;
    } else {
      return fail(res, "Falta la imagen: enviar 'foto' (multipart) o 'image_url' o 'image_base64'.");
    }

    const personas = await interpretarConGPT(imageUrl, cleanStr(b.instrucciones, 800));
    const conMatch = (b.match === 'false' || b.match === false)
      ? personas
      : await matchContraDirectorio(personas);

    return ok(res, { personas: conMatch, total: conMatch.length }, 'Lista interpretada.');
  } catch (err) {
    if (err.status) return fail(res, err.message, err.status);
    next(err);
  }
});

export default router;
