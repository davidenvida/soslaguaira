import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import multer from 'multer';
import { pool, query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { cleanStr, isNonEmptyString, normalizarCedula, toIntOrNull } from '../utils/validate.js';
import { compareNombres } from '../utils/match.js';

const router = Router();
const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

// Imagen en memoria para mandar a GPT; si se auto-guarda la lista, se persiste a /uploads.
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

const EXT_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

// Persiste el buffer de imagen en /uploads y devuelve su foto_url. (image_url se guarda tal cual.)
const guardarImagenLista = (buffer, mime) => {
  if (!buffer) return null;
  const ext = EXT_MIME[mime] || '.jpg';
  const name = `lista-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
};

// Prompt v1.3 de Hugo (FINAL, lockeado). Validado contra prod en lista de triage manuscrita
// real: nombres 20/20, cero alucinacion, cedula 18/20. Incluye cedula, estado 'trasladado' y
// propagacion de estado por encabezado de lista (doble cobertura con el post-proceso body.tipo).
// Override por request via body.instrucciones.
const SYSTEM_PROMPT = `Eres un transcriptor experto de listas manuscritas de emergencia (hospitales, refugios, albergues, morgues) tras el terremoto de La Guaira. Recibes la FOTO de una lista escrita a mano y devuelves SOLO un JSON valido con esta forma: {"personas":[{"nombre":"","cedula":"","estado":"ingresado|fallecido|herido|trasladado|desconocido","detalle":"","lugar":""}]}
REGLAS:
1. Transcribe EXACTAMENTE lo escrito. NO inventes, NO completes nombres ni apellidos, NO adivines. Si solo hay nombre, pon solo el nombre.
2. Una entrada por persona, en el ORDEN de la lista.
3. estado por persona: ingresado (ingreso/admitido/hospitalizado/vivo/estable/numero de cama o sala sin otra marca); fallecido (fallecido/muerto/occiso/obito, letra F, una cruz, o tachado con nota de deceso); herido (herido/lesionado/politraumatizado/quemado/letra H); trasladado (trasladado/referido/remitido/TRX a otro centro); desconocido (sin marca y sin contexto de lista, o ilegible).
   CONTEXTO/ENCABEZADO: si el titulo o encabezado indica el TIPO de lista, PROPAGA ese estado a TODAS las filas: Triage/Ingresos/Ingresados/Admitidos/Hospitalizados/Atendidos -> ingresado; Fallecidos/Obitos/Morgue/Decesos -> fallecido; Heridos/Lesionados/Quemados -> herido; Trasladados/Referidos/Remitidos -> trasladado. Una marca INDIVIDUAL junto a una persona SIEMPRE tiene prioridad sobre el encabezado. Usa desconocido solo si no hay ni encabezado de tipo ni marca individual. NUNCA inventes un estado sin base.
4. nombre: si una palabra es ilegible, transcribe lo legible y agrega (ilegible); si TODO es ilegible, pon (ilegible) y estado=desconocido. Conserva la ortografia tal cual.
5. cedula: numero de cedula si aparece (C.I., V-, E-, o solo digitos), tal cual; vacia si no hay. Es CLAVE para el cruce: extraela siempre que se vea.
6. detalle: OTROS datos (edad, sexo, observaciones, hora, telefono, parentesco). NO repitas la cedula aqui. Vacio si no hay.
7. lugar: cama/sala/piso/area/refugio/hospital/morgue si aparece. Vacio si no hay.
8. TACHONES: si una linea esta tachada por completo (anulacion), OMITELA. Si el tachon es una correccion, transcribe la version final. Ante duda, incluye y anota 'posible tachon' en detalle.
9. Encabezados, totales, firmas, fechas y notas que NO son personas: NO los incluyas como persona.
10. Si la imagen no es una lista de personas o esta vacia/ilegible: devuelve {"personas":[]}.
11. Devuelve UNICAMENTE el JSON, sin texto adicional ni markdown.`;

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

const soloDigitos = (s) => (s ? String(s).replace(/\D/g, '') : '');

// Extrae cedulas venezolanas (6-8 digitos) de un texto libre. Une grupos con . o espacio
// (12.345.678 -> 12345678). Los boundaries evitan capturar telefonos (10-11 digitos).
function extraerCedulas(text) {
  if (!text) return [];
  let t = String(text);
  for (let i = 0; i < 3; i++) t = t.replace(/(\d)[.\s](\d)/g, '$1$2');
  const out = new Set();
  const re = /(?<!\d)(\d{6,8})(?!\d)/g;
  let m;
  while ((m = re.exec(t))) out.add(m[1]);
  return [...out];
}

// Mapea el TIPO de la lista (lo manda el form) a un estado por defecto.
// Las personas sin marcador individual heredan el tipo de la lista (critico p.ej. fallecidos).
const estadoDeTipo = (tipo) => {
  const t = String(tipo || '').toLowerCase();
  if (/fallec|muert|occis|obito|morgue|deces/.test(t)) return 'fallecido';
  if (/traslad/.test(t)) return 'trasladado';
  if (/herid|lesion|trauma|quemad/.test(t)) return 'herido';
  if (/ingres|admit|hospital|vivo|estable/.test(t)) return 'ingresado';
  return null; // desaparecidos / desconocido / sin tipo -> no se fuerza
};

// Match de los nombres transcritos contra personas_intel.
// CONFIANZA: 'alta' = cedula exacta (definitivo); 'media' = NOMBRE Y APELLIDO coinciden.
// Evita falsos positivos por solo-apellido/solo-nombre (peligroso en rescate).
async function matchContraDirectorio(personas) {
  if (!personas.length) return personas;
  const dir = (await query(
    'SELECT id, nombre_completo, estado, parroquia, cedula, descripcion, notas, contacto FROM personas_intel WHERE duplicate_of IS NULL'
  )).rows.map((r) => ({
    ...r,
    // Llave principal: la columna cedula; mas las que aparezcan en el texto (fallback).
    cedulas: [
      ...(r.cedula ? [r.cedula] : []),
      ...extraerCedulas(`${r.nombre_completo} ${r.descripcion || ''} ${r.notas || ''} ${r.contacto || ''}`),
    ],
  }));

  return personas.map((p) => {
    const cedDigits = soloDigitos(p.cedula) || extraerCedulas(`${p.nombre || ''} ${p.detalle || ''}`)[0] || '';
    const cedula = cedDigits.length >= 6 && cedDigits.length <= 8 ? cedDigits : null;

    const coincidencias = [];
    for (const r of dir) {
      const base = { id: r.id, nombre_completo: r.nombre_completo, estado: r.estado, parroquia: r.parroquia };
      if (cedula && r.cedulas.includes(cedula)) {
        coincidencias.push({ ...base, score: 1, confianza: 'alta', motivo: 'cedula' });
        continue;
      }
      const { shared, fullSim } = compareNombres(p.nombre || '', r.nombre_completo);
      if (shared >= 2) {
        coincidencias.push({ ...base, score: fullSim, confianza: 'media', motivo: 'nombre_completo' });
      }
    }
    // cedula (alta) primero, luego por score.
    coincidencias.sort((a, b) =>
      (a.confianza === 'alta' ? 0 : 1) - (b.confianza === 'alta' ? 0 : 1) || b.score - a.score
    );
    return { ...p, cedula, coincidencias: coincidencias.slice(0, 5) };
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

    // Herencia del tipo de lista: si la persona no trae marcador propio (estado desconocido),
    // hereda el estado del tipo de la lista (ingresados/fallecidos/trasladados...).
    const estadoLista = estadoDeTipo(b.tipo);
    const conEstado = personas.map((p) => {
      if (estadoLista && (!p.estado || p.estado === 'desconocido')) {
        return { ...p, estado: estadoLista, estado_heredado: true };
      }
      return { ...p, estado_heredado: false };
    });

    const conMatch = (b.match === 'false' || b.match === false)
      ? conEstado
      : await matchContraDirectorio(conEstado);

    // Auto-guardar la lista interpretada (para 'Ver listas subidas'), salvo guardar=false.
    let listaId = null;
    let fotoUrl = null;
    if (b.guardar !== false && b.guardar !== 'false' && conMatch.length) {
      if (req.file) fotoUrl = guardarImagenLista(req.file.buffer, req.file.mimetype);
      else if (isNonEmptyString(b.image_url)) fotoUrl = b.image_url.trim().slice(0, 500);
      else if (isNonEmptyString(b.image_base64)) {
        const raw = b.image_base64.replace(/^data:[^,]+,/, '');
        fotoUrl = guardarImagenLista(Buffer.from(raw, 'base64'), b.mime || 'image/jpeg');
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const lista = (await client.query(
          `INSERT INTO listas_manuscritas (fuente, tipo, descripcion, foto_url, total_entradas)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [cleanStr(b.fuente, 200), cleanStr(b.tipo, 60), cleanStr(b.descripcion, 1000), fotoUrl, conMatch.length]
        )).rows[0];
        for (const p of conMatch) {
          await client.query(
            `INSERT INTO lista_entradas (lista_id, nombre, cedula, estado, detalle, lugar)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [lista.id, cleanStr(p.nombre, 200), normalizarCedula(p.cedula), cleanStr(p.estado, 30), cleanStr(p.detalle, 500), cleanStr(p.lugar, 200)]
          );
        }
        await client.query('COMMIT');
        listaId = lista.id;
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('[listas] auto-guardado fallo:', e.message); // no romper la interpretacion
      } finally {
        client.release();
      }
    }

    return ok(res, { personas: conMatch, total: conMatch.length, tipo_lista: estadoLista, lista_id: listaId, foto_url: fotoUrl }, 'Lista interpretada.');
  } catch (err) {
    if (err.status) return fail(res, err.message, err.status);
    next(err);
  }
});

// PRIVACIDAD: el roster (listas_manuscritas/lista_entradas) son datos de salud sin
// consentimiento y con errores de OCR -> NUNCA publicos. Estos endpoints requieren admin.
// NO existe ningun endpoint publico que lea lista_entradas; el roster solo alimenta el
// cruce interno (buscarAlertas) en la creacion de reportes.
const adminGate = (req, res, next) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return fail(res, 'Endpoint admin deshabilitado (configurar ADMIN_TOKEN).', 403);
  if (req.get('x-admin-token') !== expected) return fail(res, 'No autorizado.', 401);
  return next();
};

// POST /api/listas  -> persiste una lista YA REVISADA (motor de reunificacion hacia adelante).
// body: { fuente, tipo, descripcion, personas:[{nombre, cedula, estado, detalle, lugar}] }
router.post('/', adminGate, writeLimiter, async (req, res, next) => {
  try {
    const b = req.body || {};
    const personas = Array.isArray(b.personas) ? b.personas : [];
    const validas = personas.filter((p) => p && isNonEmptyString(p.nombre));
    if (!validas.length) return fail(res, 'La lista no tiene personas con nombre.');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lista = (await client.query(
        `INSERT INTO listas_manuscritas (fuente, tipo, descripcion, total_entradas)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [cleanStr(b.fuente, 200), cleanStr(b.tipo, 60), cleanStr(b.descripcion, 1000), validas.length]
      )).rows[0];

      for (const p of validas) {
        await client.query(
          `INSERT INTO lista_entradas (lista_id, nombre, cedula, estado, detalle, lugar)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [lista.id, cleanStr(p.nombre, 200), normalizarCedula(p.cedula), cleanStr(p.estado, 30), cleanStr(p.detalle, 500), cleanStr(p.lugar, 200)]
        );
      }
      await client.query('COMMIT');
      return ok(res, { lista_id: lista.id, total: validas.length }, 'Lista guardada.', 201);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/listas/sensibles -> cola PRIVADA de coincidencias con roster de fallecidos (admin/David).
router.get('/sensibles', adminGate, async (req, res, next) => {
  try {
    const soloPend = req.query.atendida === 'false';
    const where = soloPend ? 'WHERE atendida = false' : '';
    const { rows } = await query(
      `SELECT id, reportado_nombre, reportado_cedula, reportado_origen, entrada_nombre,
              entrada_estado, lista_fuente, lista_tipo, atendida, created_at
       FROM coincidencias_sensibles ${where} ORDER BY atendida, created_at DESC`
    );
    return ok(res, rows, 'Coincidencias sensibles (privado).');
  } catch (err) {
    next(err);
  }
});

// PATCH /api/listas/sensibles/:id -> marcar atendida (admin).
router.patch('/sensibles/:id', adminGate, async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');
    const atendida = (req.body || {}).atendida !== false; // default true
    const { rows } = await query(
      'UPDATE coincidencias_sensibles SET atendida = $1 WHERE id = $2 RETURNING *',
      [atendida, id]
    );
    if (!rows.length) return fail(res, 'No encontrada.', 404);
    return ok(res, rows[0], 'Actualizada.');
  } catch (err) {
    next(err);
  }
});

// GET /api/listas  -> resumen de listas guardadas (admin: metadata, no expone pacientes).
router.get('/', adminGate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, fuente, tipo, descripcion, foto_url,
              total_entradas AS total, created_at AS fecha
       FROM listas_manuscritas ORDER BY created_at DESC, id DESC`
    );
    return ok(res, rows, 'Listas guardadas.');
  } catch (err) {
    next(err);
  }
});

// Tipos PUBLICABLES (no sensibles): ingresados/trasladados/heridos. Fallecidos/morgue JAMAS publico.
const SQL_TIPO_PUBLICO = `(tipo ~* 'ingres|admit|hospital|atend|triage|trasl|refer|remit|herid|lesion|quemad') AND (tipo !~* 'fallec|muert|morgue|obito|deces')`;

// GET /api/listas/publicas  -> PUBLICO (sin token): solo listas no sensibles, sin cedulas.
router.get('/publicas', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, fuente, tipo, foto_url, total_entradas AS total, created_at AS fecha
       FROM listas_manuscritas WHERE ${SQL_TIPO_PUBLICO} ORDER BY created_at DESC, id DESC`
    );
    return ok(res, rows, 'Listas publicas.');
  } catch (err) {
    next(err);
  }
});

// GET /api/listas/publicas/:id  -> PUBLICO: entradas SIN cedula. 404 si la lista es sensible (fallecidos).
router.get('/publicas/:id', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');
    const lista = (await query(
      `SELECT id, fuente, tipo, foto_url, total_entradas AS total, created_at AS fecha
       FROM listas_manuscritas WHERE id = $1 AND ${SQL_TIPO_PUBLICO}`, [id]
    )).rows[0];
    if (!lista) return fail(res, 'Lista no disponible.', 404);
    // Vista publica: nombre + estado + lugar. SIN cedula (se usa solo internamente para el match).
    const entradas = (await query(
      'SELECT nombre, estado, lugar FROM lista_entradas WHERE lista_id = $1 ORDER BY id', [id]
    )).rows;
    return ok(res, { ...lista, entradas }, 'Detalle de lista (publico).');
  } catch (err) {
    next(err);
  }
});

// GET /api/listas/:id  -> entradas de una lista + sus coincidencias FRESCAS contra el directorio (admin).
router.get('/:id', adminGate, async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');
    const lista = (await query(
      `SELECT id, fuente, tipo, descripcion, foto_url, total_entradas AS total, created_at AS fecha
       FROM listas_manuscritas WHERE id = $1`, [id]
    )).rows[0];
    if (!lista) return fail(res, 'Lista no encontrada.', 404);

    const entradas = (await query(
      'SELECT nombre, cedula, estado, detalle, lugar FROM lista_entradas WHERE lista_id = $1 ORDER BY id', [id]
    )).rows;
    // Recalcula coincidencias contra el directorio actual (matcheo o no).
    const conMatch = await matchContraDirectorio(entradas);
    return ok(res, { ...lista, entradas: conMatch }, 'Detalle de lista.');
  } catch (err) {
    next(err);
  }
});

export default router;
