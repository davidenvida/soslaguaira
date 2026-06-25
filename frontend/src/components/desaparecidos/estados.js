// Estados de personas desaparecidas. Mismos colores/labels que el buscador de
// Iris (search/PersonSearch.jsx) para consistencia visual, pero local para que
// este modulo quede autocontenido y aditivo.

export const ESTADO_COLOR = {
  desaparecido: 'bg-amber-100 text-amber-800',
  a_salvo: 'bg-emerald-100 text-emerald-800',
  herido: 'bg-orange-100 text-orange-800',
  visto_con_vida: 'bg-sky-100 text-sky-800',
  fallecido: 'bg-slate-200 text-slate-700',
  desconocido: 'bg-slate-100 text-slate-600',
};

export const ESTADO_LABEL = {
  desaparecido: 'Desaparecido',
  a_salvo: 'A salvo',
  herido: 'Herido',
  visto_con_vida: 'Visto con vida',
  fallecido: 'Fallecido',
  desconocido: 'Desconocido',
};

export const estadoLabel = (estado) => ESTADO_LABEL[estado] || ESTADO_LABEL.desconocido;
export const estadoColor = (estado) => ESTADO_COLOR[estado] || ESTADO_COLOR.desconocido;
