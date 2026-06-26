// Botón invitador "Ver reportes en el mapa" con una ilustración de mapa + pin.
// Dos variantes:
//   - 'rail' (desktop lg+): tarjeta vertical en el rail izquierdo (ilustración arriba, texto abajo).
//   - 'row'  (móvil/tablet): botón horizontal ancho (ilustración a la izquierda, texto a la derecha).
// onClick -> onIrMapa (llega desde GaleriaDesaparecidos).
export default function BotonVerMapa({ onClick, variant = 'row', className = '' }) {
  const col = variant === 'rail';
  return (
    <button
      type="button"
      onClick={() => onClick?.()}
      aria-label="Ver reportes en el mapa"
      className={`group flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
        col ? 'w-full flex-col px-3 py-4 text-center' : 'w-full px-4 py-3'
      } ${className}`}
    >
      <MapaIlustracion className={col ? 'h-16 w-24' : 'h-9 w-14 shrink-0'} />
      <span className="text-sm font-bold leading-tight">Ver reportes en el mapa</span>
    </button>
  );
}

// Mapita estilizado (rutas + pin). currentColor no aplica: usa fills/strokes de Tailwind.
function MapaIlustracion({ className = '' }) {
  return (
    <svg viewBox="0 0 80 60" className={className} fill="none" aria-hidden="true">
      <rect x="2" y="2" width="76" height="56" rx="8" className="fill-emerald-50 stroke-slate-300" strokeWidth="2.5" />
      {/* "rutas" */}
      <path d="M2 24 Q22 16 40 26 T78 22" className="stroke-slate-200" strokeWidth="3" />
      <path d="M18 58 L28 32" className="stroke-slate-200" strokeWidth="3" />
      <path d="M56 2 L50 36" className="stroke-slate-200" strokeWidth="3" />
      {/* pin */}
      <path
        d="M40 16a9 9 0 0 0-9 9c0 6.6 9 17 9 17s9-10.4 9-17a9 9 0 0 0-9-9Z"
        className="fill-violet-600 transition-transform group-hover:-translate-y-0.5"
      />
      <circle cx="40" cy="25" r="3.4" className="fill-white" />
    </svg>
  );
}
