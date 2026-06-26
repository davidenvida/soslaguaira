// Chips de filtro por estado del directorio. Clickeables: filtran el directorio
// (sincronizado con `estado`/`onEstado`). Dos orientaciones:
//   - 'row' (móvil/tablet): fila scroll/wrap debajo del hero (como siempre).
//   - 'col' (desktop lg+): columna vertical para el rail derecho.
// Incluye el chip admin de "Fallecidos" (solo si hay ?token= en la URL).
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('es-VE') : '—');

// Clases estáticas (Tailwind no purga lo que no ve escrito completo).
const COLORS = {
  amber: 'bg-amber-50 ring-amber-200 text-amber-700',
  emerald: 'bg-emerald-50 ring-emerald-200 text-emerald-700',
  red: 'bg-red-50 ring-red-200 text-red-700',
  sky: 'bg-sky-50 ring-sky-200 text-sky-700',
  violet: 'bg-violet-50 ring-violet-200 text-violet-700',
};

const ACTIVE = {
  amber: 'ring-2 ring-amber-500',
  emerald: 'ring-2 ring-emerald-500',
  red: 'ring-2 ring-red-500',
  sky: 'ring-2 ring-sky-500',
  violet: 'ring-2 ring-violet-500',
};

export default function ChipsEstado({ vista = {}, estado = '', onEstado, orientacion = 'row', className = '' }) {
  const col = orientacion === 'col';
  const canFilter = typeof onEstado === 'function';

  // Token admin para el chip de fallecidos (el público nunca lo ve).
  const token =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null;

  // 'fallecido' no se muestra como chip público (privacidad).
  const chips = [
    { key: 'desaparecido', label: 'Desaparecidos', color: 'amber', filtro: 'desaparecido' },
    { key: 'a_salvo', label: 'A salvo', color: 'emerald', filtro: 'a_salvo' },
    ...(vista.atrapado > 0 ? [{ key: 'atrapado', label: 'Atrapados', color: 'red', filtro: 'atrapado' }] : []),
    { key: 'con_foto', label: 'Con foto', color: 'sky' },
    { key: 'geolocalizados', label: 'En el mapa', color: 'violet' },
  ];

  const offset = col ? 'ring-offset-white' : 'ring-offset-emerald-50';

  const renderChip = ({ key, label, color, filtro }) => {
    const clickable = canFilter && filtro !== undefined;
    const activo = clickable && filtro === estado;
    const cls = `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${COLORS[color]} ${
      activo ? `${ACTIVE[color] || 'ring-2'} ring-offset-1 ${offset}` : ''
    } ${clickable ? 'cursor-pointer transition hover:brightness-95' : ''} ${
      col ? 'w-full justify-start' : 'shrink-0 whitespace-nowrap'
    }`;
    const contenido = (
      <>
        <span className="text-base font-extrabold tabular-nums leading-none">{fmt(vista[key])}</span>
        <span className="text-xs font-medium opacity-80">{label}</span>
      </>
    );
    return (
      <li key={key} className={col ? '' : 'shrink-0'}>
        {clickable ? (
          <button type="button" onClick={() => onEstado(filtro)} aria-pressed={activo} className={cls}>
            {contenido}
          </button>
        ) : (
          <div className={cls}>{contenido}</div>
        )}
      </li>
    );
  };

  return (
    <div className={className}>
      <ul
        className={
          col
            ? 'flex flex-col gap-2'
            : 'flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center'
        }
        aria-label="Filtros del directorio"
      >
        {chips.map(renderChip)}
      </ul>

      {/* Solo admin (con ?token= en la URL): conteo de fallecidos, estilo sobrio/oscuro
          para no confundir con lo público. Clic -> página de fallecidos. */}
      {token && (
        <div className={`mt-2 flex ${col ? 'justify-stretch' : 'justify-start'}`}>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/fallecidos?token=' + encodeURIComponent(token);
            }}
            aria-label={`${fmt(vista.fallecido)} fallecidos. Abrir reportes de fallecidos (solo administrador)`}
            className={`inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 ring-1 ring-slate-600 transition hover:bg-slate-700 ${
              col ? 'w-full justify-start' : ''
            }`}
          >
            <span aria-hidden="true" className="text-sm font-extrabold tabular-nums">{fmt(vista.fallecido)}</span>
            <span aria-hidden="true">Fallecidos</span>
            <span aria-hidden="true" className="rounded bg-slate-600 px-1 text-[9px] font-bold uppercase tracking-wide">admin</span>
          </button>
        </div>
      )}
    </div>
  );
}
