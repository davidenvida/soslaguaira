// Datos mock para desarrollar las capas mientras Enzo termina el backend.
// Coordenadas reales alrededor de La Guaira (centro 10.6010, -66.9340).
// TEMPORAL: cuando el backend responda, el provider usa la API y descarta esto.
// (Los datos semilla "oficiales" son dominio de Fiona; esto es solo de apoyo.)

export const mockPersonas = [
  {
    id: 'p1', tipo: 'busco', nombre: 'María González', edad: 34,
    descripcion: 'Vista por última vez cerca del malecón.', estado: 'desaparecido',
    lat: 10.6025, lng: -66.9312, direccion: 'Av. La Playa', edificio: 'Res. Caribe', piso: '4',
    contacto_nombre: 'José González', contacto_telefono: '+584141234567',
    foto_url: 'https://i.pravatar.cc/240?img=5',
  },
  {
    id: 'p2', tipo: 'reporto', nombre: 'Carlos Pérez', edad: 28,
    descripcion: 'A salvo en el refugio de la escuela.', estado: 'a_salvo',
    lat: 10.5998, lng: -66.9365, direccion: 'Escuela Bolívar',
    contacto_nombre: 'Cruz Roja', foto_url: 'https://i.pravatar.cc/240?img=12',
  },
  {
    id: 'p3', tipo: 'busco', nombre: 'Ana Rivas', edad: 9,
    descripcion: 'Niña separada de su familia.', estado: 'visto_con_vida',
    lat: 10.6041, lng: -66.9298, direccion: 'Calle Real',
    contacto_telefono: '+584149876543',
  },
  {
    id: 'p4', tipo: 'reporto', nombre: 'Luis Mendoza', edad: 52,
    descripcion: 'Herido leve, atendido por paramédicos.', estado: 'herido',
    lat: 10.5972, lng: -66.9331, direccion: 'Av. Soublette',
  },
];

export const mockAtrapados = [
  {
    id: 'a1', cantidad_personas: 3, edificio: 'Edif. Macuto', piso: '6',
    lat: 10.6062, lng: -66.9277, direccion: 'Calle 8, Macuto', estado: 'atrapado',
    descripcion: 'Se escuchan voces en el 6to piso.', contacto: 'Vecino: +584141112233',
  },
  {
    id: 'a2', cantidad_personas: 1, edificio: 'Res. Palmar', piso: '2',
    lat: 10.5985, lng: -66.9389, direccion: 'Av. Principal', estado: 'en_rescate',
    descripcion: 'Bomberos en sitio.', contacto: 'Bomberos',
  },
  {
    id: 'a3', cantidad_personas: 2, edificio: 'Casa esquina', piso: '1',
    lat: 10.6011, lng: -66.9258, direccion: 'Sector La Veguita', estado: 'rescatado',
    descripcion: 'Rescatados con vida.',
  },
];

// Intel geocodificado (capa de desaparecidos sobre el mapa). Algunos comparten
// el mismo punto (centroide de parroquia) a propósito, para probar el spread
// anti-colisión. Reemplazado por el shape real de Enzo cuando esté geocodificado.
export const mockDesaparecidosGeo = [
  { id: 'd1', nombre_completo: 'Rosa Elena Marcano', estado: 'desaparecido', parroquia: 'Maiquetía',
    ultima_ubicacion: 'Sector Atlántida', foto_url: '', fuente_url: 'https://twitter.com/example/status/1',
    lat: 10.5990, lng: -66.9810, geo_fuente: 'edificio' },
  { id: 'd2', nombre_completo: 'Wilfredo Antonio Salas', estado: 'desaparecido', parroquia: 'Caraballeda',
    ultima_ubicacion: 'Urb. Caribe', foto_url: '', fuente_url: 'https://facebook.com/example',
    lat: 10.6130, lng: -66.8480, geo_fuente: 'parroquia' },
  { id: 'd3', nombre_completo: 'Pedro José Linares', estado: 'visto_con_vida', parroquia: 'Caraballeda',
    ultima_ubicacion: 'Casco histórico', foto_url: '', fuente_url: 'https://instagram.com/p/example',
    lat: 10.6130, lng: -66.8480, geo_fuente: 'parroquia' },
  { id: 'd4', nombre_completo: 'Yusneidy Carolina Ramos', estado: 'a_salvo', parroquia: 'Caraballeda',
    ultima_ubicacion: 'Refugio', foto_url: '', fuente_url: 'https://twitter.com/example/status/2',
    lat: 10.6130, lng: -66.8480, geo_fuente: 'parroquia' },
  { id: 'd5', nombre_completo: 'José Gregorio Pérez', estado: 'desaparecido', parroquia: 'Macuto',
    ultima_ubicacion: 'Calle 8', foto_url: '', fuente_url: 'https://twitter.com/example/status/3',
    lat: 10.6062, lng: -66.9277, geo_fuente: 'edificio' },
];

export const mockEdificios = [
  {
    id: 'e1', nombre: 'Edif. Macuto', lat: 10.6062, lng: -66.9277, direccion: 'Calle 8, Macuto',
    estado: 'atrapados', atrapados_estimados: 3, descripcion: 'Colapso parcial, personas atrapadas.',
  },
  {
    id: 'e2', nombre: 'Torre Vargas', lat: 10.6033, lng: -66.9351, direccion: 'Av. La Guaira',
    estado: 'colapsado', atrapados_estimados: 0, descripcion: 'Colapso total. Evacuado.',
  },
  {
    id: 'e3', nombre: 'Res. Palmar', lat: 10.5985, lng: -66.9389, direccion: 'Av. Principal',
    estado: 'en_rescate', atrapados_estimados: 1,
  },
  {
    id: 'e4', nombre: 'Escuela Bolívar', lat: 10.5998, lng: -66.9365, direccion: 'Calle Escuela',
    estado: 'evacuado_ok', atrapados_estimados: 0, descripcion: 'Refugio activo.',
  },
  {
    id: 'e5', nombre: 'Mercado Central', lat: 10.6049, lng: -66.9322, direccion: 'Av. Comercio',
    estado: 'dano_grave', atrapados_estimados: 0, descripcion: 'Estructura comprometida.',
  },
];
