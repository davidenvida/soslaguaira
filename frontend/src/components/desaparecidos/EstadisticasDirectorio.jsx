// Panel de estadísticas del directorio (encima del buscador). Números grandes
// con color por categoría. Lee de api.intelStats() (GET /api/intel/personas/stats)
// al montar y cada 30s (la data crece en vivo); si el endpoint no responde, cae
// a contar lo que ya cargó la galería.
//
// Cada card de estado es además un FILTRO: al tocarla, filtra el directorio por
// ese estado (sincronizado con el dropdown de la galería vía `estado`/`onEstado`).
// 'Reportes' limpia el filtro. 'Con foto' y 'En el mapa' son informativas.
import { useEffect, useState } from 'react';
import * as api from '../../api';

const POLL_MS = 30000;
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('es-VE') : '—');

const porEstado = (s, estado) =>
  s?.por_estado?.[estado] ?? s?.estados?.[estado] ?? s?.[estado] ?? 0;

// Normaliza la respuesta del endpoint: { total, por_estado:{...}, con_foto, geolocalizados }.
const desdeStats = (s) => ({
  total: s?.total ?? s?.count ?? 0,
  desaparecido: porEstado(s, 'desaparecido'),
  a_salvo: porEstado(s, 'a_salvo'),
  fallecido: porEstado(s, 'fallecido'),
  atrapado: porEstado(s, 'atrapado'),
  con_foto: s?.con_foto ?? s?.conFoto ?? 0,
  geolocalizados: s?.geolocalizados ?? s?.geocodificados ?? 0,
});

// Fallback: cuenta sobre los registros ya cargados (aprox., puede estar filtrado).
const desdeItems = (items = []) => {
  const v = { total: items.length, desaparecido: 0, a_salvo: 0, fallecido: 0, atrapado: 0, con_foto: 0, geolocalizados: 0 };
  for (const p of items) {
    if (p.estado === 'desaparecido') v.desaparecido++;
    else if (p.estado === 'a_salvo') v.a_salvo++;
    else if (p.estado === 'fallecido') v.fallecido++;
    else if (p.estado === 'atrapado') v.atrapado++;
    if (p.foto_url) v.con_foto++;
    if (typeof p.lat === 'number' && typeof p.lng === 'number') v.geolocalizados++;
  }
  return v;
};

// Clases estáticas (Tailwind no purga lo que no ve escrito completo).
const COLORS = {
  rose: 'bg-rose-50 ring-rose-200 text-rose-700',
  amber: 'bg-amber-50 ring-amber-200 text-amber-700',
  emerald: 'bg-emerald-50 ring-emerald-200 text-emerald-700',
  slate: 'bg-slate-100 ring-slate-200 text-slate-700',
  red: 'bg-red-50 ring-red-200 text-red-700',
  sky: 'bg-sky-50 ring-sky-200 text-sky-700',
  violet: 'bg-violet-50 ring-violet-200 text-violet-700',
};

// Anillo de selección activa (estático por color).
const ACTIVE = {
  rose: 'ring-2 ring-rose-500',
  amber: 'ring-2 ring-amber-500',
  emerald: 'ring-2 ring-emerald-500',
  slate: 'ring-2 ring-slate-500',
  red: 'ring-2 ring-red-500',
};

export default function EstadisticasDirectorio({ items = [], estado = '', onEstado, accion = null, titulo = null }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (typeof api.intelStats !== 'function') return undefined;
    let vivo = true;
    const cargar = () =>
      api
        .intelStats()
        .then((res) => {
          if (vivo && res) setStats(desdeStats(res));
        })
        .catch(() => {});
    cargar();
    const id = setInterval(cargar, POLL_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  const vista = stats ?? desdeItems(items);

  // `filtro` define el estado que aplica la card al hacer clic ('' = limpiar).
  // Sin `filtro` => informativa (no clickeable). herido/visto_con_vida no se muestran.
  const cards = [
    { key: 'total', label: 'Reportes', color: 'rose', filtro: '' },
    { key: 'desaparecido', label: 'Desaparecidos', color: 'amber', filtro: 'desaparecido' },
    { key: 'a_salvo', label: 'A salvo', color: 'emerald', filtro: 'a_salvo' },
    // 'Fallecidos' no se muestra en el directorio público (privacidad).
    ...(vista.atrapado > 0 ? [{ key: 'atrapado', label: 'Atrapados', color: 'red', filtro: 'atrapado' }] : []),
    { key: 'con_foto', label: 'Con foto', color: 'sky' },
    { key: 'geolocalizados', label: 'En el mapa', color: 'violet' },
  ];

  const canFilter = typeof onEstado === 'function';

  return (
    // Barra verde clara: secuencia izquierda-a-derecha -> título + divisor + los
    // chips (en una fila que scrollea si no entra), y la acción a la DERECHA.
    // En móvil apila (título+chips arriba con scroll-x, acción abajo) sin romperse.
    <div className="-mx-3 mb-3 flex flex-col gap-2 border-y border-emerald-100 bg-emerald-50 px-3 py-2 sm:-mx-4 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-1">
        {titulo && (
          <>
            <div className="shrink-0">{titulo}</div>
            <span className="h-5 w-px shrink-0 bg-emerald-300" aria-hidden="true" />
          </>
        )}
        <ul className="flex flex-nowrap gap-2" aria-label="Estadísticas del directorio">
          {cards.map(({ key, label, color, filtro }) => {
        const clickable = canFilter && filtro !== undefined;
        const activo = clickable && filtro === estado;
        const cls = `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 ring-1 ${COLORS[color]} ${
          activo ? `${ACTIVE[color] || 'ring-2'} ring-offset-1 ring-offset-slate-50` : ''
        } ${clickable ? 'cursor-pointer transition hover:brightness-95' : ''}`;

        const contenido = (
          <>
            <span className="text-base font-extrabold tabular-nums leading-none">{fmt(vista[key])}</span>
            <span className="text-xs font-medium opacity-80">{label}</span>
          </>
        );

        return (
          <li key={key} className="shrink-0">
            {clickable ? (
              <button type="button" onClick={() => onEstado(filtro)} aria-pressed={activo} className={cls}>
                {contenido}
              </button>
            ) : (
              <div className={cls}>{contenido}</div>
            )}
          </li>
        );
      })}
        </ul>
      </div>
      {/* Acción a la derecha de la barra (debajo en móvil). */}
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}
