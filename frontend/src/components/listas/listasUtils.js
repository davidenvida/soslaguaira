// Utilidades compartidas de listas manuscritas: tipos, colores de estado, mapeo
// de coincidencias y normalización de la respuesta. Las usan SubirListaManuscrita
// (resultado de interpretar) y VerListasSubidas (detalle de una lista guardada).

export const TIPOS = [
  { value: 'ingresados', label: 'Ingresados' },
  { value: 'trasladados', label: 'Trasladados' },
  { value: 'heridos', label: 'Heridos' },
  { value: 'fallecidos', label: 'Fallecidos' },
  { value: 'refugiados', label: 'Refugiados' },
  { value: 'otro', label: 'Otro' },
];

// Estado individual de cada persona en la lista (puede venir heredado del tipo).
export const ESTADO_LISTA = {
  ingresado: 'bg-emerald-100 text-emerald-800',
  trasladado: 'bg-sky-100 text-sky-800',
  herido: 'bg-amber-100 text-amber-800',
  fallecido: 'bg-slate-200 text-slate-700',
  desconocido: 'bg-slate-100 text-slate-500',
};

export const MATCH = {
  cedula: { label: 'Confirmada (cédula)', cls: 'bg-emerald-100 text-emerald-800' },
  posible: { label: 'Posible', cls: 'bg-amber-100 text-amber-800' },
  ninguna: { label: 'Sin coincidencia', cls: 'bg-slate-100 text-slate-600' },
};

// Normaliza data.personas a filas. Cada persona trae un array `coincidencias`
// (0/1/varias); tomamos la mejor (mayor score): confianza 'alta'(cédula)=confirmada,
// 'media'(nombre)=posible, vacío=ninguna.
export const normalizarFilas = (res) => {
  // interpretar -> data.personas ; detalle de lista guardada -> data.entradas.
  const personas =
    res?.personas || res?.entradas || res?.data?.personas || res?.data?.entradas || (Array.isArray(res) ? res : []);
  return (Array.isArray(personas) ? personas : []).map((p) => {
    const coincs = Array.isArray(p.coincidencias) ? p.coincidencias : [];
    const best = coincs.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    const matchTipo = !best ? 'ninguna' : best.confianza === 'alta' ? 'cedula' : 'posible';
    return {
      nombre: p.nombre || p.nombre_completo || '—',
      cedula: p.cedula || '',
      estado: p.estado || '',
      estadoHeredado: !!(p.estado_heredado ?? p.estadoHeredado),
      matchTipo,
      personaNombre: best?.nombre_completo || '',
      personaEstado: best?.estado || '',
      otras: coincs.length > 1 ? coincs.length - 1 : 0,
    };
  });
};
