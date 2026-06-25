// Matching de personas: similitud de nombre (fuzzy) + cercania geografica.

// Distancia Haversine en metros entre dos coordenadas.
export const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Distancia de Levenshtein entre dos strings.
const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prevDiag = tmp;
    }
  }
  return prev[b.length];
};

// Similitud de nombre 0..1. Combina similitud global + coincidencia por tokens.
export const nameSimilarity = (a, b) => {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;

  const maxLen = Math.max(na.length, nb.length);
  const global = maxLen === 0 ? 0 : 1 - levenshtein(na, nb) / maxLen;

  const ta = new Set(na.split(' '));
  const tb = nb.split(' ');
  let hits = 0;
  for (const t of tb) {
    for (const u of ta) {
      const m = Math.max(t.length, u.length);
      if (m > 0 && 1 - levenshtein(t, u) / m >= 0.8) {
        hits++;
        break;
      }
    }
  }
  const tokenScore = tb.length === 0 ? 0 : hits / Math.max(ta.size, tb.length);

  return Math.max(global, tokenScore);
};

// Comparacion ESTRICTA de nombres para match de identidad (evita falsos positivos).
// Devuelve { shared, fullSim }:
//  - shared = cuantos tokens (>=3 letras) del nombre A tienen un token fuerte (>=0.85) en B.
//    Exigir shared>=2 obliga a que coincidan NOMBRE y APELLIDO, no uno solo.
//  - fullSim = similitud global del nombre completo normalizado (para ranking).
export const compareNombres = (a, b) => {
  const na = normalize(a);
  const nb = normalize(b);
  const toks = (s) => s.split(' ').filter((t) => t.length >= 3);
  const ta = toks(na);
  const tb = toks(nb);
  const simTok = (x, y) => { const m = Math.max(x.length, y.length); return m ? 1 - levenshtein(x, y) / m : 0; };
  let shared = 0;
  for (const x of ta) if (tb.some((y) => simTok(x, y) >= 0.85)) shared++;
  const m = Math.max(na.length, nb.length);
  const fullSim = m ? 1 - levenshtein(na, nb) / m : 0;
  return { shared, fullSim: Number(fullSim.toFixed(3)) };
};

// Match ESTRICTO de identidad por nombre (para coincidencias automaticas, NO busqueda manual).
// Exige: (a) >=2 tokens compartidos Y (b) overlap de APELLIDO (el ultimo token de alguno
// aparece en el otro). Asi 'Maria Fernanda Rojas' NO matchea 'Maria Fernanda Rey Rujano'
// (nombres de pila iguales pero apellido distinto). Acepta nombre parcial vs completo si el
// apellido coincide ('Maria Gonzalez' vs 'Maria Jose Gonzalez Perez').
export const nombresCoinciden = (a, b) => {
  const na = normalize(a);
  const nb = normalize(b);
  const ta = na.split(' ').filter((t) => t.length >= 3);
  const tb = nb.split(' ').filter((t) => t.length >= 3);
  if (!ta.length || !tb.length) return false;
  const sim = (x, y) => { const m = Math.max(x.length, y.length); return m ? 1 - levenshtein(x, y) / m : 0; };

  let shared = 0;
  for (const x of ta) if (tb.some((y) => sim(x, y) >= 0.85)) shared++;
  if (shared < 2) return false;

  // Match de APELLIDO estricto: exige misma inicial + alta similitud. Asi 'Fernandez' != 'Hernandez'
  // (difieren en la inicial F/H) se RECHAZA, pero 'Gonzalez'/'Gonzales' (misma inicial, variante) pasa.
  const lastA = ta[ta.length - 1];
  const lastB = tb[tb.length - 1];
  const apMatch = (x, y) => x[0] === y[0] && sim(x, y) >= 0.85;
  const apellidoOverlap = tb.some((y) => apMatch(lastA, y)) || ta.some((x) => apMatch(lastB, x));
  return apellidoOverlap;
};

// Puntaje combinado de match entre persona base y candidato.
// Pondera nombre (0.7) y cercania (0.3, decae a 0 sobre ~2km).
export const matchScore = (base, candidate) => {
  const name = nameSimilarity(base.nombre, candidate.nombre);

  let distanceMeters = null;
  let proximity = 0;
  if (
    base.lat != null && base.lng != null &&
    candidate.lat != null && candidate.lng != null
  ) {
    distanceMeters = haversineMeters(base.lat, base.lng, candidate.lat, candidate.lng);
    proximity = Math.max(0, 1 - distanceMeters / 2000);
  }

  const score = name * 0.7 + proximity * 0.3;
  return { score: Number(score.toFixed(4)), nameSimilarity: Number(name.toFixed(4)), distanceMeters };
};
