// Datos mock de personas para desarrollo mientras Enzo termina el backend.
// Respetan el [MODELO DE DATOS] del contrato (proyecto.md).
// Centro del mapa: lat 10.6010, lng -66.9340 (La Guaira).

export const MOCK_PERSONAS = [
  {
    id: 1,
    tipo: 'busco',
    nombre: 'María Fernández',
    edad: 34,
    descripcion: 'Vestía franela azul. Vista por última vez cerca de la plaza.',
    foto_url: null,
    estado: 'desaparecido',
    lat: 10.6021,
    lng: -66.9351,
    direccion: 'Av. Soublette, Maiquetía',
    edificio: null,
    piso: null,
    contacto_nombre: 'José Fernández',
    contacto_telefono: '0412-1112233',
    created_at: '2026-06-25T01:10:00Z',
  },
  {
    id: 2,
    tipo: 'reporto',
    nombre: 'María Fernández',
    edad: 34,
    descripcion: 'A salvo en refugio de la escuela. Buen estado.',
    foto_url: null,
    estado: 'a_salvo',
    lat: 10.5998,
    lng: -66.9302,
    direccion: 'Refugio E.B. Catia La Mar',
    edificio: 'Escuela Básica',
    piso: null,
    contacto_nombre: 'Coordinador refugio',
    contacto_telefono: '0414-9998877',
    created_at: '2026-06-25T02:40:00Z',
  },
  {
    id: 3,
    tipo: 'busco',
    nombre: 'Carlos Rodríguez',
    edad: 51,
    descripcion: 'Diabético, necesita medicación.',
    foto_url: null,
    estado: 'desaparecido',
    lat: 10.6045,
    lng: -66.9388,
    direccion: 'Sector Las Tunitas',
    edificio: null,
    piso: null,
    contacto_nombre: 'Ana Rodríguez',
    contacto_telefono: '0426-5554433',
    created_at: '2026-06-25T00:30:00Z',
  },
  {
    id: 4,
    tipo: 'reporto',
    nombre: 'Luisa Pérez',
    edad: 28,
    descripcion: 'Reportada a salvo por vecinos.',
    foto_url: null,
    estado: 'a_salvo',
    lat: 10.6010,
    lng: -66.9340,
    direccion: 'Calle Real de Maiquetía',
    edificio: null,
    piso: null,
    contacto_nombre: 'Vecino',
    contacto_telefono: '0412-7776655',
    created_at: '2026-06-25T03:05:00Z',
  },
  {
    id: 5,
    tipo: 'busco',
    nombre: 'Pedro Gómez',
    edad: 12,
    descripcion: 'Niño separado de su familia durante la evacuación.',
    foto_url: null,
    estado: 'visto_con_vida',
    lat: 10.5985,
    lng: -66.9415,
    direccion: 'Cerca del puerto',
    edificio: null,
    piso: null,
    contacto_nombre: 'Madre',
    contacto_telefono: '0424-3332211',
    created_at: '2026-06-25T01:50:00Z',
  },
];

const ESTADO_LABEL = {
  desaparecido: 'Desaparecido',
  a_salvo: 'A salvo',
  herido: 'Herido',
  visto_con_vida: 'Visto con vida',
  fallecido: 'Fallecido',
  desconocido: 'Desconocido',
};

export function estadoLabel(estado) {
  return ESTADO_LABEL[estado] || 'Desconocido';
}

// Simula latencia de red (conectividad mala) para ver loading states reales.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Misma firma/forma que api.js: listPersonas(params) -> data (array directo).
// Filtra por q (nombre), estado y tipo. Semántica de GET /api/personas.
export async function mockSearchPersonas({ q = '', estado = '', tipo = '' } = {}) {
  await wait(350);
  const needle = q.trim().toLowerCase();
  return MOCK_PERSONAS.filter((p) => {
    if (needle && !p.nombre.toLowerCase().includes(needle)) return false;
    if (estado && p.estado !== estado) return false;
    if (tipo && p.tipo !== tipo) return false;
    return true;
  });
}

// Misma forma que api.js -> matchPersona(id): GET /api/personas/:id/match
// devuelve el ARRAY crudo de coincidencias (igual que GET /api/personas).
// Cada item: persona en snake_case + match_score (0..1), name_similarity (0..1)
// y distance_meters (metros, puede ser null).
export async function mockGetMatch(id) {
  await wait(400);
  const base = MOCK_PERSONAS.find((p) => p.id === Number(id));
  if (!base) return [];

  const objetivo = base.tipo === 'busco' ? 'reporto' : 'busco';
  return MOCK_PERSONAS.filter(
    (p) => p.id !== base.id && p.tipo === objetivo && nombreSimilar(p.nombre, base.nombre)
  )
    .map((p) => {
      const name_similarity = similitudNombre(base.nombre, p.nombre);
      const distance_meters =
        base.lat != null && p.lat != null
          ? Math.round(distanciaKm(base.lat, base.lng, p.lat, p.lng) * 1000)
          : null;
      return { ...p, name_similarity, distance_meters, match_score: scoreCoincidencia(name_similarity, distance_meters) };
    })
    .sort((a, b) => b.match_score - a.match_score);
}

function nombreSimilar(a, b) {
  const na = a.toLowerCase().split(/\s+/);
  const nb = b.toLowerCase().split(/\s+/);
  return na.some((t) => t.length > 2 && nb.includes(t));
}

// Similitud 0..1 por tokens compartidos (mock; el backend trae el valor real).
function similitudNombre(a, b) {
  const na = a.toLowerCase().split(/\s+/).filter(Boolean);
  const nb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (!na.length) return 0;
  const comunes = na.filter((t) => nb.has(t)).length;
  return comunes / Math.max(na.length, nb.size);
}

// Score 0..1 combinando similitud de nombre y cercanía.
function scoreCoincidencia(name_similarity, distance_meters) {
  let score = name_similarity * 0.7;
  if (distance_meters != null) {
    if (distance_meters < 1000) score += 0.3;
    else if (distance_meters < 3000) score += 0.15;
  }
  return Math.min(1, Number(score.toFixed(2)));
}

export function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
