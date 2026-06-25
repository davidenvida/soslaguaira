// Mock de respaldo para desarrollar la galeria mientras intelPersonas()/el
// endpoint /api/intel/personas no responda. TEMPORAL: el componente usa la API
// real apenas este disponible. Datos ilustrativos (no personas reales).

export const mockDesaparecidos = [
  {
    id: 'i1', nombre_completo: 'Rosa Elena Marcano', edad: 41, estado: 'desaparecido',
    parroquia: 'Maiquetía', ultima_ubicacion: 'Cerca del aeropuerto, sector Atlántida',
    descripcion: 'Estatura media, cabello castaño. Vestía suéter azul.',
    foto_url: 'https://i.pravatar.cc/400?img=45',
    fuente_url: 'https://twitter.com/example/status/1', fecha_reporte: '2026-06-24T18:30:00Z',
  },
  {
    id: 'i2', nombre_completo: 'Pedro José Linares', edad: 67, estado: 'visto_con_vida',
    parroquia: 'La Guaira', ultima_ubicacion: 'Casco histórico',
    descripcion: 'Adulto mayor, camina con bastón. Reportado visto en refugio.',
    foto_url: 'https://i.pravatar.cc/400?img=53',
    fuente_url: 'https://instagram.com/p/example', fecha_reporte: '2026-06-24T20:10:00Z',
  },
  {
    id: 'i3', nombre_completo: 'Yusneidy Carolina Ramos', edad: 23, estado: 'a_salvo',
    parroquia: 'Macuto', ultima_ubicacion: 'Refugio Escuela Bolívar',
    descripcion: 'Confirmada a salvo por familiares.',
    foto_url: '', // sin foto -> placeholder
    fuente_url: 'https://twitter.com/example/status/2', fecha_reporte: '2026-06-25T08:00:00Z',
  },
  {
    id: 'i4', nombre_completo: 'Wilfredo Antonio Salas', edad: 38, estado: 'desaparecido',
    parroquia: 'Caraballeda', ultima_ubicacion: 'Urbanización Caribe, calle 3',
    descripcion: 'Trabajador de la zona. Sin contacto desde el sismo.',
    foto_url: 'https://i.pravatar.cc/400?img=14',
    fuente_url: 'https://facebook.com/example', fecha_reporte: '2026-06-24T22:45:00Z',
  },
];
