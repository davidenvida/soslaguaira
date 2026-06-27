// Hero del directorio (cabecera del match). Recibe `vista` (cifras ya calculadas por
// GaleriaDesaparecidos) y renderiza las 3 cards simétricas + flechas. Los chips de
// filtro viven en <ChipsEstado/>: fila bajo el hero en móvil (aquí), rail vertical en
// desktop (lo monta la galería a la derecha).
import ChipsEstado from './ChipsEstado';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('es-VE') : '—');

export default function EstadisticasDirectorio({
  vista = {},
  estado = '',
  onEstado,
  accion = null,
  titulo = null,
  onIrHospitales,
}) {
  // La card de hospital navega a su módulo. Guard: si la prop no viene, queda undefined.
  const irHospitales = typeof onIrHospitales === 'function' ? onIrHospitales : undefined;

  const canFilter = typeof onEstado === 'function';
  // Tocar el número de la izquierda (Reportes) limpia el filtro = ver todos.
  const verTodosActivo = canFilter && estado === '';

  return (
    <div className="-mx-3 mb-3 border-y-2 border-slate-700 bg-emerald-50 px-3 py-3 sm:-mx-4 sm:px-4 lg:mx-0 lg:rounded-2xl lg:border-2">
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
            Icono de personas a la IZQUIERDA del número (enmarca el centro). */}
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

      {/* Chips de filtro: fila bajo el hero SOLO en móvil/tablet. En desktop (lg+) los
          monta la galería como rail vertical a la derecha (aquí van ocultos). */}
      <ChipsEstado
        className="mt-3 lg:hidden"
        orientacion="row"
        vista={vista}
        estado={estado}
        onEstado={onEstado}
      />
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
    card: 'bg-emerald-50 ring-emerald-400 sos-glow-magico',
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

/* Resplandor "mágico" de la card central (Posibles coincidencias): halo emerald que
   respira lento y vira sutil a teal. Sin transform (no afecta layout / 320). */
.sos-glow-magico{animation:sos-glow 2.8s ease-in-out infinite}
@keyframes sos-glow{
  0%,100%{box-shadow:0 0 13px 1px rgba(16,185,129,.40),0 8px 22px -6px rgba(16,185,129,.40)}
  50%{box-shadow:0 0 30px 8px rgba(20,184,166,.62),0 8px 26px -4px rgba(16,185,129,.55)}
}
@media (prefers-reduced-motion: reduce){
  .sos-glow-magico{animation:none;box-shadow:0 0 22px 4px rgba(16,185,129,.55),0 8px 22px -4px rgba(16,185,129,.5)}
}
`;
function FlujoEstilos() {
  return <style>{FLUJO_CSS}</style>;
}
