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

const ICONS = {
  rose: 'M7 3h7l5 5v13H7zM14 3v5h5',
  amber: 'M12 2a7 7 0 0 0-7 7c0 4 7 13 7 13s7-9 7-13a7 7 0 0 0-7-7zm0 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  emerald: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  slate: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z',
  red: 'M1 21h22L12 2zM12 16a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 12 16zm-1-7v5h2V9z',
  sky: 'M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  violet: 'M12 2a7 7 0 0 0-7 7c0 4 7 13 7 13s7-9 7-13a7 7 0 0 0-7-7zm0 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
};

export default function EstadisticasDirectorio({ items = [], estado = '', onEstado }) {
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
    { key: 'fallecido', label: 'Fallecidos', color: 'slate', filtro: 'fallecido' },
    ...(vista.atrapado > 0 ? [{ key: 'atrapado', label: 'Atrapados', color: 'red', filtro: 'atrapado' }] : []),
    { key: 'con_foto', label: 'Con foto', color: 'sky' },
    { key: 'geolocalizados', label: 'En el mapa', color: 'violet' },
  ];

  const canFilter = typeof onEstado === 'function';

  return (
    <ul
      className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4"
      aria-label="Estadísticas del directorio"
    >
      {cards.map(({ key, label, color, filtro }) => {
        const clickable = canFilter && filtro !== undefined;
        const activo = clickable && filtro === estado;
        const cls = `flex w-full items-center gap-2 rounded-xl p-2 text-left ring-1 sm:gap-3 sm:p-3 ${COLORS[color]} ${
          activo ? ACTIVE[color] || 'ring-2' : ''
        } ${clickable ? 'cursor-pointer transition hover:brightness-95' : ''}`;

        const contenido = (
          <>
            <svg
              className="hidden h-7 w-7 shrink-0 opacity-80 sm:block"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d={ICONS[color]} />
            </svg>
            <div className="min-w-0">
              <div className="text-xl font-extrabold leading-none tabular-nums sm:text-3xl">{fmt(vista[key])}</div>
              <div className="mt-0.5 truncate text-[10px] font-medium opacity-80 sm:mt-1 sm:text-xs">{label}</div>
            </div>
          </>
        );

        return (
          <li key={key}>
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
  );
}
