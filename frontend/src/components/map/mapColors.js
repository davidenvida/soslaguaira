// Paleta de estados para las capas del mapa (SOS La Guaira).
// Un solo lugar para los colores: los usan iconos, popups, leyenda y panel.

export const PERSONA_ESTADOS = {
  desaparecido: { color: '#f59e0b', label: 'Desaparecido' },
  a_salvo: { color: '#16a34a', label: 'A salvo' },
  herido: { color: '#ea580c', label: 'Herido' },
  visto_con_vida: { color: '#2563eb', label: 'Visto con vida' },
  fallecido: { color: '#374151', label: 'Fallecido' },
  desconocido: { color: '#9ca3af', label: 'Desconocido' },
};

export const ATRAPADO_ESTADOS = {
  atrapado: { color: '#dc2626', label: 'Atrapado', urgente: true },
  en_rescate: { color: '#f59e0b', label: 'En rescate' },
  rescatado: { color: '#16a34a', label: 'Rescatado' },
  fallecido: { color: '#374151', label: 'Fallecido' },
};

export const EDIFICIO_ESTADOS = {
  colapsado: { color: '#7f1d1d', label: 'Colapsado' },
  dano_grave: { color: '#dc2626', label: 'Daño grave' },
  atrapados: { color: '#ea580c', label: 'Con atrapados' },
  en_rescate: { color: '#f59e0b', label: 'En rescate' },
  evacuado_ok: { color: '#16a34a', label: 'Evacuado OK' },
};

const FALLBACK = { color: '#9ca3af', label: 'Desconocido' };

export const personaEstado = (estado) => PERSONA_ESTADOS[estado] || FALLBACK;
export const atrapadoEstado = (estado) => ATRAPADO_ESTADOS[estado] || FALLBACK;
export const edificioEstado = (estado) => EDIFICIO_ESTADOS[estado] || FALLBACK;
