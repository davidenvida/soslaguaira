// Helpers de validacion y saneamiento. La validacion SIEMPRE corre en backend.

export const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

// Normaliza un nombre para agrupar duplicados: minusculas, sin acentos, espacios colapsados.
export const normalizeName = (v) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const oneOf = (v, allowed) => allowed.includes(v);

// Sanea string: recorta y limita longitud. Evita inyeccion de HTML basico.
export const cleanStr = (v, maxLen = 500) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s.length === 0) return null;
  return s.slice(0, maxLen).replace(/[<>]/g, '');
};

export const toNumberOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const toIntOrNull = (v) => {
  const n = toNumberOrNull(v);
  return n === null ? null : Math.trunc(n);
};

// Valida un par lat/lng. Devuelve {lat, lng} o null si invalido/ausente.
export const validCoords = (lat, lng) => {
  const la = toNumberOrNull(lat);
  const ln = toNumberOrNull(lng);
  if (la === null || ln === null) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
};
