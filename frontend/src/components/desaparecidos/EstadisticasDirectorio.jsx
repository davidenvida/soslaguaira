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

// Normaliza la respuesta del endpoint: { total, por_estado:{...}, con_foto, geolocalizados,
// posibles_coincidencias, personas_listas_hospital }.
const desdeStats = (s) => ({
  total: s?.total ?? s?.count ?? 0,
  desaparecido: porEstado(s, 'desaparecido'),
  a_salvo: porEstado(s, 'a_salvo'),
  fallecido: porEstado(s, 'fallecido'),
  atrapado: porEstado(s, 'atrapado'),
  con_foto: s?.con_foto ?? s?.conFoto ?? 0,
  geolocalizados: s?.geolocalizados ?? s?.geocodificados ?? 0,
  posibles_coincidencias: s?.posibles_coincidencias ?? s?.posiblesCoincidencias ?? 0,
  personas_listas_hospital: s?.personas_listas_hospital ?? s?.personasListasHospital ?? 0,
});

// Fallback: cuenta sobre los registros ya cargados (aprox., puede estar filtrado).
// Las cifras del match (coincidencias / listas) solo vienen del endpoint -> 0 mientras carga.
const desdeItems = (items = []) => {
  const v = {
    total: items.length, desaparecido: 0, a_salvo: 0, fallecido: 0, atrapado: 0,
    con_foto: 0, geolocalizados: 0, posibles_coincidencias: 0, personas_listas_hospital: 0,
  };
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

export default function EstadisticasDirectorio({
  items = [],
  estado = '',
  onEstado,
  accion = null,
  titulo = null,
  onIrHospitales,
  onIrMapa,
}) {
  const [stats, setStats] = useState(null);

  // Navegación desde las cards del hero (las cards reemplazan a los tabs). Guard:
  // si la prop no viene, el handler queda undefined y no rompe.
  const irHospitales = typeof onIrHospitales === 'function' ? onIrHospitales : undefined;
  const irMapa = typeof onIrMapa === 'function' ? onIrMapa : undefined;

  // Token de admin en la URL (?token=...). Con token, el endpoint devuelve además el
  // conteo de fallecidos (gated por X-Admin-Token). El público (sin token) jamás lo ve.
  const token =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('token')
      : null;

  useEffect(() => {
    if (typeof api.intelStats !== 'function') return undefined;
    let vivo = true;
    const cargar = () =>
      api
        .intelStats(token || undefined)
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
  }, [token]);

  const vista = stats ?? desdeItems(items);

  // Chips de filtro secundarios (debajo del hero). 'Reportes' sube al hero (número izquierdo).
  // Sin `filtro` => informativa (no clickeable). 'fallecido' no se muestra (privacidad).
  const chips = [
    { key: 'desaparecido', label: 'Desaparecidos', color: 'amber', filtro: 'desaparecido' },
    { key: 'a_salvo', label: 'A salvo', color: 'emerald', filtro: 'a_salvo' },
    ...(vista.atrapado > 0 ? [{ key: 'atrapado', label: 'Atrapados', color: 'red', filtro: 'atrapado' }] : []),
    { key: 'con_foto', label: 'Con foto', color: 'sky' },
    { key: 'geolocalizados', label: 'En el mapa', color: 'violet' },
  ];

  const canFilter = typeof onEstado === 'function';

  const renderChip = ({ key, label, color, filtro }) => {
    const clickable = canFilter && filtro !== undefined;
    const activo = clickable && filtro === estado;
    const cls = `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 ring-1 ${COLORS[color]} ${
      activo ? `${ACTIVE[color] || 'ring-2'} ring-offset-1 ring-offset-emerald-50` : ''
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
  };

  // Tocar el número de la izquierda (Reportes) limpia el filtro = ver todos.
  const verTodosActivo = canFilter && estado === '';

  return (
    <div className="-mx-3 mb-3 border-y border-emerald-100 bg-emerald-50 px-3 py-3 sm:-mx-4 sm:px-4">
      {titulo && <div className="mb-2 flex justify-center sm:justify-start">{titulo}</div>}

      {/* HERO del match: 3 cards simétricas [Reportes rojo] → [Coincidencias verde glow] ← [Listas azul].
          Entre ellas, flechas animadas que FLUYEN hacia el centro (Reportes y Listas alimentan
          las coincidencias). Desktop (sm+): fila, flechas → y ←. Móvil (<sm): apiladas, flechas
          ↓ (bajo Reportes) y ↑ (sobre Listas) apuntando a la card central. Entra sin recorte a 320px. */}
      <FlujoEstilos />
      <div
        role="group"
        aria-label="Resumen del cruce: reportes y personas en listas de hospital alimentan las posibles coincidencias"
        className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2.5"
      >
        {/* IZQUIERDA: Reportes (principal, rojo). Tocar la card limpia el filtro = ver todos.
            Icono de personas a la IZQUIERDA del número (enmarca el centro). En la esquina
            inferior derecha, un botón-pin (hermano, no anidado) que lleva al mapa. */}
        <div className="relative flex min-w-0 flex-1">
          <StatCard
            valor={fmt(vista.total)}
            label="Reportes"
            numero="text-4xl"
            tono="reportes"
            icono={<IconPersonas className="h-7 w-7 sm:h-9 sm:w-9" />}
            iconoLado="left"
            onClick={canFilter ? () => onEstado('') : undefined}
            activo={verTodosActivo}
          />
          <button
            type="button"
            onClick={() => irMapa?.()}
            aria-label="Ver en el mapa"
            className="absolute bottom-2 right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-white shadow-md ring-2 ring-white transition hover:bg-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
              <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
            </svg>
          </button>
        </div>

        {/* Flujo Reportes -> centro. */}
        <div className="flex shrink-0 items-center justify-center">
          <FlechaFlujo dir="down" tint="reportes" className="inline-flex sm:hidden" />
          <FlechaFlujo dir="right" tint="reportes" className="hidden sm:inline-flex" />
        </div>

        {/* CENTRO: corazón del match (verde con resplandor) + botón para ver coincidencias. */}
        <StatCard
          valor={fmt(vista.posibles_coincidencias)}
          label="Posibles coincidencias"
          numero="text-3xl sm:text-4xl"
          tono="coincidencias"
        >
          {accion && <div className="mt-2 w-full">{accion}</div>}
        </StatCard>

        {/* Flujo Listas de hospital -> centro. */}
        <div className="flex shrink-0 items-center justify-center">
          <FlechaFlujo dir="up" tint="listas" className="inline-flex sm:hidden" />
          <FlechaFlujo dir="left" tint="listas" className="hidden sm:inline-flex" />
        </div>

        {/* DERECHA: En listas de hospital (azul, simétrica a Reportes). Card entera clickeable
            -> módulo de hospitales. Icono de hospital a la DERECHA del número. */}
        <StatCard
          valor={fmt(vista.personas_listas_hospital)}
          label="En listas de hospital"
          numero="text-3xl sm:text-4xl"
          tono="listas"
          icono={<IconHospital className="h-7 w-7 sm:h-9 sm:w-9" />}
          iconoLado="right"
          onClick={irHospitales}
          ariaLabel="Ver módulo de hospitales"
        />
      </div>

      {/* Chips de filtro secundarios (siguen filtrando el directorio). */}
      {chips.length > 0 && (
        <ul
          className="mt-3 flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center"
          aria-label="Filtros del directorio"
        >
          {chips.map(renderChip)}
        </ul>
      )}

      {/* Solo admin (con token en la URL): conteo de fallecidos, estilo sobrio/oscuro
          para que no se confunda con lo público. Clic -> página de fallecidos.
          Alineado a la izquierda para no quedar bajo el botón flotante "Reportar" (fixed abajo-derecha). */}
      {token && (
        <div className="mt-2 flex justify-start">
          <button
            type="button"
            onClick={() => {
              window.location.href = '/fallecidos?token=' + encodeURIComponent(token);
            }}
            aria-label={`${fmt(vista.fallecido)} fallecidos. Abrir reportes de fallecidos (solo administrador)`}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 ring-1 ring-slate-600 transition hover:bg-slate-700"
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

// Card del hero. Las 3 son simétricas (misma estructura/tamaño); cambia el color por `tono`.
// 'reportes' rojo (principal), 'coincidencias' verde con resplandor (corazón del match),
// 'listas' azul (simétrica a reportes). `numero` controla el tamaño del número.
const HERO_TONO = {
  reportes: {
    card: 'bg-red-50 ring-red-300',
    num: 'text-red-600',
    label: 'text-red-700',
    icon: 'text-red-500',
    activo: 'ring-red-500',
  },
  coincidencias: {
    card: 'bg-emerald-50 ring-emerald-400 shadow-lg shadow-emerald-400/60',
    num: 'text-emerald-700',
    label: 'text-emerald-700',
    icon: 'text-emerald-500',
  },
  listas: {
    card: 'bg-sky-50 ring-sky-300',
    num: 'text-sky-700',
    label: 'text-sky-700',
    icon: 'text-sky-500',
    activo: 'ring-sky-500',
  },
};

function StatCard({ valor, label, numero, tono, onClick, activo, icono, iconoLado, ariaLabel, children }) {
  const t = HERO_TONO[tono] || HERO_TONO.listas;
  const base = `flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-center ring-2 ${t.card}`;
  const aria = ariaLabel || `${valor} ${label}`;
  const contenido = (
    <>
      <span className="flex items-center justify-center gap-1.5">
        {icono && iconoLado === 'left' && <span aria-hidden="true" className={`shrink-0 ${t.icon}`}>{icono}</span>}
        <span aria-hidden="true" className={`font-black leading-none tabular-nums ${numero} ${t.num}`}>{valor}</span>
        {icono && iconoLado === 'right' && <span aria-hidden="true" className={`shrink-0 ${t.icon}`}>{icono}</span>}
      </span>
      <span aria-hidden="true" className={`mt-1 text-[11px] font-bold leading-tight sm:text-xs ${t.label}`}>{label}</span>
      {children}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={activo}
        aria-label={aria}
        className={`${base} cursor-pointer transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 ${activo ? `ring-offset-1 ${t.activo || ''}` : ''}`}
      >
        {contenido}
      </button>
    );
  }
  return (
    <div className={base} aria-label={aria} role="group">
      {contenido}
    </div>
  );
}

// Iconos temáticos de las cards laterales (SVG inline, currentColor hereda el tono).
// Personas (Reportes) y cruz médica/hospital (En listas de hospital).
function IconPersonas({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-2.67 0-8 1.34-8 4v2h9.09a5.5 5.5 0 0 1 1.16-3.79C9.55 13.08 8.66 13 8 13Zm8 0c-.35 0-.74.02-1.15.06A5.49 5.49 0 0 1 17 16.5V19h7v-2c0-2.66-5.33-4-8-4Z" />
    </svg>
  );
}

function IconHospital({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M10 2a1 1 0 0 0-1 1v6H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h6v6a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-6h6a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-6V3a1 1 0 0 0-1-1h-4Z" />
    </svg>
  );
}

// Flecha de "flujo": 3 chevrons que pulsan/se deslizan HACIA el centro, mostrando que
// Reportes (rojo) y Listas de hospital (azul) alimentan las coincidencias (verde).
// `dir` = sentido hacia el centro: 'right'/'left' (desktop) | 'down'/'up' (móvil apilado).
// `tint` = origen del flujo para teñir del color de origen -> verde junto al centro.
// Decorativa: aria-hidden. Respeta prefers-reduced-motion (queda estática). Sin librerías.
const FLOW_ROT = { right: 0, left: 180, down: 90, up: -90 };
// Dirección del layout vía utilidades Tailwind (evita pelear especificidad con `hidden`).
const FLOW_DIR_CLASS = {
  right: 'flex-row',
  left: 'flex-row-reverse',
  down: 'flex-col',
  up: 'flex-col-reverse',
};
const FLOW_TINT = {
  reportes: ['text-red-400', 'text-orange-400', 'text-emerald-500'],
  listas: ['text-sky-400', 'text-cyan-400', 'text-emerald-500'],
};
function FlechaFlujo({ dir, tint, className = '' }) {
  const rot = FLOW_ROT[dir] ?? 0;
  // Del origen (lejos del centro) al verde (junto al centro). El último chevron en el
  // flujo es verde, reforzando "rojo/azul alimentan el verde".
  const colores = FLOW_TINT[tint] || ['text-emerald-400', 'text-emerald-400', 'text-emerald-500'];
  return (
    <span aria-hidden="true" className={`items-center justify-center ${FLOW_DIR_CLASS[dir]} ${className}`}>
      {colores.map((c, i) => (
        <span key={i} className={`sosflow-ch sosflow-anim-${dir} ${c}`} style={{ animationDelay: `${i * 0.18}s` }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: `rotate(${rot}deg)` }}
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      ))}
    </span>
  );
}

// Solo la animación de los chevrons (keyframes). El layout/visibilidad va por Tailwind.
// Scoped a este archivo (sin tocar index.css ni añadir libs).
const FLUJO_CSS = `
.sosflow-ch{display:inline-flex;animation-duration:1.3s;animation-iteration-count:infinite;animation-timing-function:ease-in-out}
.sosflow-anim-right{animation-name:sosflow-x-r}
.sosflow-anim-left{animation-name:sosflow-x-l}
.sosflow-anim-down{animation-name:sosflow-y-d}
.sosflow-anim-up{animation-name:sosflow-y-u}
@keyframes sosflow-x-r{0%,100%{opacity:.2;transform:translateX(-3px)}50%{opacity:1;transform:translateX(3px)}}
@keyframes sosflow-x-l{0%,100%{opacity:.2;transform:translateX(3px)}50%{opacity:1;transform:translateX(-3px)}}
@keyframes sosflow-y-d{0%,100%{opacity:.2;transform:translateY(-3px)}50%{opacity:1;transform:translateY(3px)}}
@keyframes sosflow-y-u{0%,100%{opacity:.2;transform:translateY(3px)}50%{opacity:1;transform:translateY(-3px)}}
@media (prefers-reduced-motion: reduce){.sosflow-ch{animation:none!important;opacity:1!important;transform:none!important}}
`;
function FlujoEstilos() {
  return <style>{FLUJO_CSS}</style>;
}
