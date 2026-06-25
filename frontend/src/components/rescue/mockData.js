// Datos mock de atrapados (RESCATE URGENTE) mientras Enzo termina el backend.
// Respetan el [MODELO DE DATOS] tabla atrapados (proyecto.md).

export const MOCK_ATRAPADOS = [
  {
    id: 1,
    cantidad_personas: 4,
    edificio: 'Residencias Caribe',
    piso: 6,
    lat: 10.6038,
    lng: -66.9361,
    direccion: 'Av. La Costanera, Macuto',
    estado: 'atrapado',
    descripcion: 'Familia atrapada, hay un bebé. Se escuchan voces.',
    foto_url: null,
    contacto: '0412-1234567',
    created_at: '2026-06-25T03:20:00Z',
    updated_at: '2026-06-25T03:20:00Z',
  },
  {
    id: 2,
    cantidad_personas: 1,
    edificio: 'Edif. El Faro',
    piso: 2,
    lat: 10.6006,
    lng: -66.9325,
    direccion: 'Calle Real, Maiquetía',
    estado: 'en_rescate',
    descripcion: 'Hombre con pierna atrapada. Bomberos en sitio.',
    foto_url: null,
    contacto: '0414-7654321',
    created_at: '2026-06-25T02:00:00Z',
    updated_at: '2026-06-25T03:40:00Z',
  },
  {
    id: 3,
    cantidad_personas: 8,
    edificio: 'Colegio San José',
    piso: 1,
    lat: 10.5979,
    lng: -66.9402,
    direccion: 'Sector Catia La Mar',
    estado: 'atrapado',
    descripcion: 'Grupo en sótano inundado. Urgente, sube el agua.',
    foto_url: null,
    contacto: '0426-9988776',
    created_at: '2026-06-25T03:55:00Z',
    updated_at: '2026-06-25T03:55:00Z',
  },
  {
    id: 4,
    cantidad_personas: 2,
    edificio: 'Posada Mar Azul',
    piso: 3,
    lat: 10.6052,
    lng: -66.9290,
    direccion: 'Camurí Chico',
    estado: 'rescatado',
    descripcion: 'Pareja rescatada, trasladada a refugio.',
    foto_url: null,
    contacto: '0412-5566778',
    created_at: '2026-06-25T01:10:00Z',
    updated_at: '2026-06-25T03:10:00Z',
  },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Orden de urgencia: 'atrapado' y 'en_rescate' primero, luego created_at desc.
// (rescatado/fallecido al final). Igual que GET /api/atrapados.
const PRIORIDAD = { atrapado: 0, en_rescate: 1, rescatado: 2, fallecido: 3 };

export function ordenarPorUrgencia(lista) {
  return [...lista].sort((a, b) => {
    const pa = PRIORIDAD[a.estado] ?? 9;
    const pb = PRIORIDAD[b.estado] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

// Misma forma que api.js: listAtrapados(params) -> data (array directo).
export async function mockListAtrapados({ estado = '' } = {}) {
  await wait(300);
  const data = estado ? MOCK_ATRAPADOS.filter((a) => a.estado === estado) : MOCK_ATRAPADOS;
  return ordenarPorUrgencia(data);
}

// Misma forma que api.js: updateAtrapado(id, payload) -> data (objeto actualizado).
export async function mockUpdateAtrapado(id, payload) {
  await wait(250);
  const item = MOCK_ATRAPADOS.find((a) => a.id === Number(id));
  if (item) Object.assign(item, payload, { updated_at: new Date().toISOString() });
  return item;
}
