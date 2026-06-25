import { Router } from 'express';
import { pool, query } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { intelLimiter } from '../middleware/rateLimit.js';
import {
  isNonEmptyString, oneOf, cleanStr, toIntOrNull, toNumberOrNull, normalizeName, validCoords, normalizarCedula,
} from '../utils/validate.js';
import { buildGeocoder } from '../utils/geocode.js';
import { evaluarAlertas } from '../utils/alertas.js';
import { adminGate } from '../middleware/adminGate.js';

const router = Router();

// Ingesta confiable (asistentes internas), pero con backstop laxo.
router.use(intelLimiter);

const ESTADOS_INTEL = ['desaparecido', 'a_salvo', 'fallecido', 'atrapado'];
const ORIGENES = ['osint', 'app'];
const INFORMADO_VIAS = ['telefono', 'publicacion'];
const TIPOS_RESIDENCIA = ['urbanizacion', 'edificio', 'sector'];

// Acepta un objeto suelto, un array, o { items: [...] }.
const toItems = (body) => {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.items)) return body.items;
  if (body && typeof body === 'object') return [body];
  return [];
};

// Inserta un batch ya validado dentro de una transaccion, con dedup (ON CONFLICT DO NOTHING).
// rowsBuilder(item) -> array de params en el orden del INSERT.
async function insertBatch(sql, items, rowsBuilder) {
  const client = await pool.connect();
  const ids = [];
  try {
    await client.query('BEGIN');
    for (const it of items) {
      const r = await client.query(sql, rowsBuilder(it));
      if (r.rows.length) ids.push(r.rows[0].id);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return ids;
}

// ---------- PERSONAS INTEL ----------

// POST /api/intel/personas  (single | array | {items:[...]})
// Exito parcial: inserta las filas validas y reporta las invalidas en 'rejected'.
// fuente_url es OBLIGATORIO para trazabilidad (cada persona enlazada a su tweet).
router.post('/personas', async (req, res, next) => {
  try {
    const items = toItems(req.body);
    if (!items.length) return fail(res, 'No se recibieron registros.');

    const valid = [];
    const rejected = [];
    items.forEach((raw, i) => {
      const it = raw || {};
      const origen = it.origen || 'osint';
      if (!isNonEmptyString(it.nombre_completo)) {
        rejected.push({ index: i, reason: 'nombre_completo es obligatorio', item: raw });
      } else if (!oneOf(it.estado, ESTADOS_INTEL)) {
        rejected.push({ index: i, reason: `estado invalido (${ESTADOS_INTEL.join('|')})`, item: raw });
      } else if (!oneOf(origen, ORIGENES)) {
        rejected.push({ index: i, reason: `origen invalido (${ORIGENES.join('|')})`, item: raw });
      } else if (origen === 'osint' && !isNonEmptyString(it.fuente_url)) {
        // fuente_url solo es obligatorio para OSINT (trazabilidad al tweet); la app no tiene tweet.
        rejected.push({ index: i, reason: 'fuente_url requerido para trazabilidad (origen osint)', item: raw });
      } else {
        valid.push(it);
      }
    });

    // UPSERT: un re-post del mismo (nombre_completo, fuente_url) ENRIQUECE los campos
    // presentes (COALESCE: el dato nuevo solo pisa si no es null) en vez de ignorarse.
    // (xmax = 0) distingue fila recien insertada (true) de actualizada (false).
    const sql = `
      INSERT INTO personas_intel
        (nombre_completo, edad, estado, ultima_ubicacion, parroquia, sector_o_edificio,
         descripcion, foto_url, reportante, relacion, contacto, fuente_url, fecha_reporte, notas,
         origen, lat, lng, cedula)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, COALESCE($13, now()), $14, $15, $16, $17, $18)
      ON CONFLICT (nombre_completo, fuente_url) DO UPDATE SET
        cedula            = COALESCE(EXCLUDED.cedula, personas_intel.cedula),
        edad              = COALESCE(EXCLUDED.edad, personas_intel.edad),
        estado            = COALESCE(EXCLUDED.estado, personas_intel.estado),
        ultima_ubicacion  = COALESCE(EXCLUDED.ultima_ubicacion, personas_intel.ultima_ubicacion),
        parroquia         = COALESCE(EXCLUDED.parroquia, personas_intel.parroquia),
        sector_o_edificio = COALESCE(EXCLUDED.sector_o_edificio, personas_intel.sector_o_edificio),
        descripcion       = COALESCE(EXCLUDED.descripcion, personas_intel.descripcion),
        foto_url          = CASE
                              WHEN personas_intel.foto_url LIKE '/uploads/%'
                              THEN personas_intel.foto_url
                              ELSE COALESCE(EXCLUDED.foto_url, personas_intel.foto_url)
                            END,
        reportante        = COALESCE(EXCLUDED.reportante, personas_intel.reportante),
        relacion          = COALESCE(EXCLUDED.relacion, personas_intel.relacion),
        contacto          = COALESCE(EXCLUDED.contacto, personas_intel.contacto),
        notas             = COALESCE(EXCLUDED.notas, personas_intel.notas),
        lat               = COALESCE(EXCLUDED.lat, personas_intel.lat),
        lng               = COALESCE(EXCLUDED.lng, personas_intel.lng)
      RETURNING id, (xmax = 0) AS is_insert`;

    const buildParams = (it) => {
      const coords = validCoords(it.lat, it.lng); // pin directo del mapa (o null)
      return [
        cleanStr(it.nombre_completo, 200),
        toIntOrNull(it.edad),
        it.estado,
        cleanStr(it.ultima_ubicacion, 300),
        cleanStr(it.parroquia, 120),
        cleanStr(it.sector_o_edificio, 200),
        cleanStr(it.descripcion, 2000),
        cleanStr(it.foto_url, 500),
        cleanStr(it.reportante, 200),
        cleanStr(it.relacion, 120),
        cleanStr(it.contacto, 120),
        cleanStr(it.fuente_url, 500),
        it.fecha_reporte || null, // null -> COALESCE a now()
        cleanStr(it.notas, 2000),
        it.origen === 'app' ? 'app' : 'osint',
        coords ? coords.lat : null,
        coords ? coords.lng : null,
        normalizarCedula(it.cedula),
      ];
    };

    let inserted = 0;
    let updated = 0;
    const ids = [];
    if (valid.length) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const it of valid) {
          const r = await client.query(sql, buildParams(it));
          if (r.rows.length) {
            ids.push(r.rows[0].id);
            if (r.rows[0].is_insert) inserted++; else updated++;
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    // Alerta proactiva (solo origen 'app' = reporte de familia, consentido; solo por cedula).
    const alertas = [];
    for (const it of valid) {
      if ((it.origen || 'osint') !== 'app') continue;
      const ced = normalizarCedula(it.cedula);
      if (!ced) continue;
      const hits = await evaluarAlertas(query, { nombre: it.nombre_completo, cedula: ced, origen: 'intel-app' });
      if (hits.length) alertas.push({ nombre: it.nombre_completo, cedula: ced, coincidencias: hits });
    }

    return ok(
      res,
      { inserted, updated, ids, rejected, alertas },
      `${inserted} insertado(s), ${updated} actualizado(s), ${rejected.length} rechazado(s).`,
      201
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/intel/personas?estado=&parroquia=&q=&limit=&offset=&incluir_duplicados=
// Por defecto excluye los registros ya marcados como duplicados (duplicate_of NOT NULL),
// para que la galeria no muestre la misma persona dos veces. ?incluir_duplicados=true los trae.
// Paginacion: ?limit=&offset= (limit cap 500). El body trae meta { total, limit, offset, page, pages }.
router.get('/personas', async (req, res, next) => {
  try {
    const { estado, parroquia, q } = req.query;
    const conds = [];
    const params = [];

    const inclDup = req.query.includeDuplicates ?? req.query.incluir_duplicados;
    const incluirDups = inclDup === 'true' || inclDup === '1';
    if (!incluirDups) conds.push('duplicate_of IS NULL');

    // PRIVACIDAD (decision David): los FALLECIDOS no van en el directorio publico (no se listan
    // ni se cuentan). Solo admin (X-Admin-Token) puede verlos (ej ?estado=fallecido con token).
    const esAdmin = process.env.ADMIN_TOKEN && req.get('x-admin-token') === process.env.ADMIN_TOKEN;
    if (!esAdmin) conds.push("estado <> 'fallecido'");

    // Filtro opcional de flaggeadas (takedown): flagged=false oculta, flagged=true = cola de revision.
    if (req.query.flagged === 'false') conds.push('flagged = false');
    else if (req.query.flagged === 'true') conds.push('flagged = true');

    if (estado) {
      if (!oneOf(estado, ESTADOS_INTEL)) return fail(res, "Filtro 'estado' invalido.");
      params.push(estado);
      conds.push(`estado = $${params.length}`);
    }
    if (req.query.origen) {
      if (!oneOf(req.query.origen, ORIGENES)) return fail(res, "Filtro 'origen' invalido (osint|app).");
      params.push(req.query.origen);
      conds.push(`origen = $${params.length}`);
    }
    if (parroquia && String(parroquia).trim()) {
      params.push(`%${String(parroquia).trim()}%`);
      conds.push(`parroquia ILIKE $${params.length}`);
    }
    if (q && String(q).trim()) {
      params.push(`%${String(q).trim()}%`);
      conds.push(
        `(nombre_completo ILIKE $${params.length} OR descripcion ILIKE $${params.length} OR ultima_ubicacion ILIKE $${params.length} OR sector_o_edificio ILIKE $${params.length})`
      );
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    // Total para paginacion (con los mismos filtros, sin limit/offset).
    const total = Number(
      (await query(`SELECT count(*)::int AS c FROM personas_intel ${where}`, params)).rows[0].c
    );

    // Paginacion: limit por defecto 60, cap 500. Acepta offset directo o page (1-based).
    const limRaw = toIntOrNull(req.query.limit);
    const offRaw = toIntOrNull(req.query.offset);
    const pageRaw = toIntOrNull(req.query.page);
    const limit = limRaw === null ? 60 : Math.min(Math.max(limRaw, 1), 2000); // cap alto: leer "toda la base" en 1 call
    let offset;
    if (offRaw !== null) offset = Math.max(offRaw, 0);
    else if (pageRaw !== null) offset = Math.max(pageRaw - 1, 0) * limit;
    else offset = 0;

    const pageParams = [...params, limit, offset];
    // Orden: primero los que TIENEN foto (para que la galeria/mapa no parezcan sin fotos), luego recientes.
    const { rows } = await query(
      `SELECT * FROM personas_intel ${where}
       ORDER BY (foto_url IS NOT NULL) DESC, created_at DESC, id DESC
       LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
      pageParams
    );

    // Ubicacion: si la fila trae lat/lng directos (pin del formulario) se usan tal cual
    // (geo_fuente='precisa'); si no, se geocodifica contra el gazetteer de residencias.
    const gaz = (await query('SELECT nombre, parroquia, lat, lon FROM residencias')).rows;
    const geocode = buildGeocoder(gaz);
    const items = rows.map((r) =>
      (r.lat != null && r.lng != null)
        ? { ...r, geo_fuente: 'precisa' }
        : { ...r, ...geocode(r) }
    );

    const data = {
      items,
      total,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
    return ok(res, data, `Intel de personas (${rows.length} de ${total}).`);
  } catch (err) {
    next(err);
  }
});

// GET /api/intel/personas/duplicados
// Agrupa por nombre_completo NORMALIZADO (lower + sin acentos) y devuelve los grupos
// con mas de 1 registro, para revision/union (dedup cross-fuente: misma persona en X e IG).
router.get('/personas/duplicados', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, nombre_completo, edad, estado, parroquia, sector_o_edificio,
              fuente_url, fuentes, fecha_reporte
       FROM personas_intel
       WHERE duplicate_of IS NULL
       ORDER BY id`
    );

    const groups = new Map();
    for (const r of rows) {
      const key = normalizeName(r.nombre_completo);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    const dups = [];
    for (const [key, registros] of groups) {
      if (registros.length > 1) {
        dups.push({ nombre_normalizado: key, count: registros.length, registros });
      }
    }
    dups.sort((a, b) => b.count - a.count);

    return ok(res, dups, `${dups.length} grupo(s) de posibles duplicados.`);
  } catch (err) {
    next(err);
  }
});

// GET /api/intel/personas/stats  -> resumen del directorio PUBLICO (no-duplicados, SIN fallecidos).
// Los fallecidos no se cuentan en la metrica publica (decision de privacidad de David).
router.get('/personas/stats', async (req, res, next) => {
  try {
    const rows = (await query(
      `SELECT estado, origen, foto_url, lat, lng, sector_o_edificio, ultima_ubicacion, parroquia
       FROM personas_intel WHERE duplicate_of IS NULL AND estado <> 'fallecido'`
    )).rows;

    const gaz = (await query('SELECT nombre, parroquia, lat, lon FROM residencias')).rows;
    const geocode = buildGeocoder(gaz);

    // Shape estable: incluye los 6 estados aunque intel solo use 4 (los otros quedan en 0).
    const por_estado = {
      desaparecido: 0, a_salvo: 0, herido: 0, visto_con_vida: 0, fallecido: 0, atrapado: 0,
    };
    const por_origen = { osint: 0, app: 0 }; // equipo (osint) vs usuarios externos (app)
    let con_foto = 0;
    let geolocalizados = 0;

    for (const r of rows) {
      if (r.estado in por_estado) por_estado[r.estado] += 1;
      if (r.origen in por_origen) por_origen[r.origen] += 1;
      if (r.foto_url) con_foto += 1;
      const geocodable = (r.lat != null && r.lng != null) || geocode(r).lat != null;
      if (geocodable) geolocalizados += 1;
    }

    return ok(res, { total: rows.length, por_estado, por_origen, con_foto, geolocalizados }, 'Estadisticas del directorio.');
  } catch (err) {
    next(err);
  }
});

// GET /api/intel/personas/:id -> ficha completa (incluye contacto/reportante/relacion para
// avisar a la familia en la reunificacion). Fallecidos 404 para no-admin (privacidad).
router.get('/personas/:id', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');
    const r = await query('SELECT * FROM personas_intel WHERE id = $1', [id]);
    if (!r.rows.length) return fail(res, 'Persona no encontrada.', 404);
    const row = r.rows[0];
    const esAdmin = process.env.ADMIN_TOKEN && req.get('x-admin-token') === process.env.ADMIN_TOKEN;
    if (row.estado === 'fallecido' && !esAdmin) return fail(res, 'Persona no encontrada.', 404);
    return ok(res, row, 'Ficha de persona.');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/intel/personas/:id -> elimina un registro erroneo (admin). Libera duplicate_of que lo apunten.
router.delete('/personas/:id', adminGate, async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');
    const exists = (await query('SELECT id FROM personas_intel WHERE id = $1', [id])).rows[0];
    if (!exists) return fail(res, 'Registro no encontrado.', 404);
    await query('UPDATE personas_intel SET duplicate_of = NULL WHERE duplicate_of = $1', [id]);
    await query('DELETE FROM personas_intel WHERE id = $1', [id]);
    return ok(res, { id }, 'Registro eliminado.');
  } catch (err) {
    next(err);
  }
});

// PATCH /api/intel/personas/:id
// Enriquece una fila existente: escribe foto_url y actualiza campos presentes
// (ultima_ubicacion, parroquia, sector_o_edificio, descripcion, contacto, relacion, edad, estado),
// anexa una 2da fuente (agregar_fuente) y/o marca duplicate_of. Merge sin borrar.
router.patch('/personas/:id', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');

    const exists = (await query('SELECT id FROM personas_intel WHERE id = $1', [id])).rows[0];
    if (!exists) return fail(res, 'Registro no encontrado.', 404);

    const b = req.body || {};
    const sets = [];
    const params = [];
    const addSet = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    // Campos enriquecibles (solo los presentes en el body).
    if (b.foto_url !== undefined) addSet('foto_url', cleanStr(b.foto_url, 500));
    if (b.cedula !== undefined) addSet('cedula', normalizarCedula(b.cedula));
    // fuente_url PRIMARIO editable (corregir cruces de fuente). No puede quedar vacio.
    if (b.fuente_url !== undefined) {
      if (!isNonEmptyString(b.fuente_url)) return fail(res, "'fuente_url' no puede quedar vacio.");
      addSet('fuente_url', cleanStr(b.fuente_url, 500));
    }
    if (b.ultima_ubicacion !== undefined) addSet('ultima_ubicacion', cleanStr(b.ultima_ubicacion, 300));
    if (b.parroquia !== undefined) addSet('parroquia', cleanStr(b.parroquia, 120));
    if (b.sector_o_edificio !== undefined) addSet('sector_o_edificio', cleanStr(b.sector_o_edificio, 200));
    if (b.descripcion !== undefined) addSet('descripcion', cleanStr(b.descripcion, 2000));
    if (b.contacto !== undefined) addSet('contacto', cleanStr(b.contacto, 120));
    if (b.relacion !== undefined) addSet('relacion', cleanStr(b.relacion, 120));
    if (b.edad !== undefined) addSet('edad', toIntOrNull(b.edad));
    if (b.estado !== undefined) {
      if (!oneOf(b.estado, ESTADOS_INTEL)) return fail(res, `'estado' invalido (${ESTADOS_INTEL.join('|')}).`);
      addSet('estado', b.estado);
      // Revertir a busqueda: sella revertido_at y conserva los confirmado_* como historial.
      if (b.estado === 'desaparecido') sets.push('revertido_at = now()');
    }
    // Auditoria de quien confirma el 'a salvo' (responsabilidad: detiene la busqueda).
    if (b.confirmado_por !== undefined) {
      addSet('confirmado_por', cleanStr(b.confirmado_por, 200));
      sets.push('confirmado_at = now()');
    }
    if (b.confirmado_contacto !== undefined) addSet('confirmado_contacto', cleanStr(b.confirmado_contacto, 200));
    // Tracking de aviso a la familia (reunificacion): ADMIN-ONLY (accion del equipo, no publica).
    if (b.informado_familia !== undefined || b.informado_via !== undefined) {
      const esAdmin = process.env.ADMIN_TOKEN && req.get('x-admin-token') === process.env.ADMIN_TOKEN;
      if (!esAdmin) return fail(res, "Marcar 'informado a la familia' requiere admin (X-Admin-Token).", 401);
    }
    if (b.informado_via !== undefined) {
      if (b.informado_via !== null && !oneOf(b.informado_via, INFORMADO_VIAS)) {
        return fail(res, `'informado_via' invalido (${INFORMADO_VIAS.join('|')}).`);
      }
      addSet('informado_via', b.informado_via);
    }
    if (b.informado_familia !== undefined) {
      const inf = b.informado_familia === true || b.informado_familia === 'true';
      addSet('informado_familia', inf);
      sets.push(inf ? 'informado_at = now()' : 'informado_at = NULL'); // sello al informar, limpia al desmarcar
    }
    // 'notas' (plural) SOBRESCRIBE el campo (correccion/reconciliacion).
    if (b.notas !== undefined) addSet('notas', cleanStr(b.notas, 2000));
    // 'nota' (singular) ANEXA a notas (no pisa), para dejar rastro de la correccion (trazabilidad).
    if (isNonEmptyString(b.nota)) {
      params.push(cleanStr(b.nota, 2000));
      sets.push(`notas = concat_ws(E'\\n', notas, $${params.length}::text)`);
    }
    if (b.duplicate_of !== undefined) {
      if (b.duplicate_of === null) {
        addSet('duplicate_of', null);
      } else {
        const dupId = toIntOrNull(b.duplicate_of);
        if (dupId === null) return fail(res, "'duplicate_of' invalido.");
        if (dupId === id) return fail(res, 'Un registro no puede ser duplicado de si mismo.');
        const target = (await query('SELECT id FROM personas_intel WHERE id = $1', [dupId])).rows[0];
        if (!target) return fail(res, "El 'duplicate_of' referenciado no existe.", 404);
        addSet('duplicate_of', dupId);
      }
    }

    let row;
    if (sets.length) {
      params.push(id);
      row = (await query(
        `UPDATE personas_intel SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      )).rows[0];
    }

    // Anexar una fuente adicional (jsonb, sin duplicar dentro del array).
    const nuevaFuente = b.agregar_fuente ?? b.fuente_url_2 ?? b.fuente;
    if (isNonEmptyString(nuevaFuente)) {
      row = (await query(
        `UPDATE personas_intel
           SET fuentes = (
             SELECT to_jsonb(array_agg(DISTINCT e))
             FROM jsonb_array_elements_text(fuentes || to_jsonb($1::text)) AS e
           )
         WHERE id = $2
         RETURNING *`,
        [cleanStr(nuevaFuente, 500), id]
      )).rows[0];
    }

    if (!row) return fail(res, 'No hay cambios para actualizar.');
    return ok(res, row, 'Registro actualizado.');
  } catch (err) {
    next(err);
  }
});

// POST /api/intel/personas/:id/flag  { motivo }
// Takedown: marca la ficha para revision/remocion humana. NO borra.
router.post('/personas/:id/flag', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) return fail(res, 'ID invalido.');

    const motivo = cleanStr((req.body || {}).motivo, 1000);
    const { rows } = await query(
      `UPDATE personas_intel
         SET flagged = true, flag_motivo = $1, flagged_at = now()
       WHERE id = $2
       RETURNING *`,
      [motivo, id]
    );
    if (!rows.length) return fail(res, 'Ficha no encontrada.', 404);
    return ok(res, rows[0], 'Ficha marcada para revision. Un humano la revisara.', 201);
  } catch (err) {
    next(err);
  }
});

// ---------- RESIDENCIAS ----------

// POST /api/intel/residencias  (single | array | {items:[...]})
router.post('/residencias', async (req, res, next) => {
  try {
    const items = toItems(req.body);
    if (!items.length) return fail(res, 'No se recibieron registros.');

    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      if (!isNonEmptyString(it.nombre)) {
        return fail(res, `Item ${i}: 'nombre' es obligatorio.`);
      }
      if (it.tipo !== undefined && it.tipo !== null && !oneOf(it.tipo, TIPOS_RESIDENCIA)) {
        return fail(res, `Item ${i}: 'tipo' invalido (${TIPOS_RESIDENCIA.join('|')}).`);
      }
    }

    // DEDUP por (nombre, parroquia): carga incremental sin duplicar.
    const sql = `
      INSERT INTO residencias (nombre, parroquia, tipo, lat, lon, fuente)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT DO NOTHING
      RETURNING id`;

    const ids = await insertBatch(sql, items, (it) => [
      cleanStr(it.nombre, 200),
      cleanStr(it.parroquia, 120),
      it.tipo ? it.tipo : null,
      toNumberOrNull(it.lat),
      toNumberOrNull(it.lon),
      cleanStr(it.fuente, 500),
    ]);

    const skipped = items.length - ids.length;
    return ok(
      res,
      { inserted: ids.length, ids, skipped },
      `${ids.length} insertada(s), ${skipped} duplicada(s) omitida(s).`,
      201
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/intel/residencias?parroquia=&tipo=&q=
router.get('/residencias', async (req, res, next) => {
  try {
    const { parroquia, tipo, q } = req.query;
    const conds = [];
    const params = [];

    if (tipo) {
      if (!oneOf(tipo, TIPOS_RESIDENCIA)) return fail(res, "Filtro 'tipo' invalido.");
      params.push(tipo);
      conds.push(`tipo = $${params.length}`);
    }
    if (parroquia && String(parroquia).trim()) {
      params.push(`%${String(parroquia).trim()}%`);
      conds.push(`parroquia ILIKE $${params.length}`);
    }
    if (q && String(q).trim()) {
      params.push(`%${String(q).trim()}%`);
      conds.push(`nombre ILIKE $${params.length}`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM residencias ${where} ORDER BY created_at DESC, id DESC`,
      params
    );
    return ok(res, rows, 'Listado de residencias.');
  } catch (err) {
    next(err);
  }
});

export default router;
