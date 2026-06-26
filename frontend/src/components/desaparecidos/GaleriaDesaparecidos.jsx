// Galería de personas desaparecidas (intel real re-hosteado). Lee de la API
// GET /api/intel/personas via intelPersonas(params); si aún no existe el método
// o el backend no responde, cae a mock para no quedar en blanco.
//
// Contrato (snake_case, confirmado por Fiona): nombre_completo, edad, estado,
// ultima_ubicacion, parroquia, sector_o_edificio, descripcion, foto_url,
// fuente_url, fecha_reporte, duplicate_of, fuentes[].
//   - Mostrar solo duplicate_of === null (el endpoint trae duplicados).
//   - Filtros server-side: q, estado, parroquia (AND, case-insensitive).
//   - Respuesta paginada: { items, total, limit, offset, page, pages }.
//     "cargar más" usa pages (heurística de batch lleno como fallback).
import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../api';
import useDebounce from '../search/useDebounce';
import DesaparecidoCard from './DesaparecidoCard';
import EstadisticasDirectorio from './EstadisticasDirectorio';
import ChipsEstado from './ChipsEstado';
import BusquedaUnificada from './BusquedaUnificada';
import { ESTADO_LABEL } from './estados';
import { mockDesaparecidos } from './mockDesaparecidos';

const LIMIT = 30;
const STATS_POLL_MS = 30000;

// --- Estadísticas del directorio (alimentan el hero y los chips de filtro) ---
const porEstado = (s, estado) =>
  s?.por_estado?.[estado] ?? s?.estados?.[estado] ?? s?.[estado] ?? 0;

// Normaliza la respuesta de GET /api/intel/personas/stats.
const statsDesdeApi = (s) => ({
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

// Fallback mientras el endpoint no responde: cuenta sobre lo ya cargado (aprox.).
// Las cifras del match (coincidencias / listas) solo vienen del endpoint -> 0.
const statsDesdeItems = (items = []) => {
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

// Parroquias de La Guaira/Vargas como semilla del filtro (se completa con las
// que aparezcan en los datos reales).
const PARROQUIAS_SEED = [
  'Caraballeda', 'Carayaca', 'Carlos Soublette', 'Catia La Mar', 'El Junko',
  'La Guaira', 'Macuto', 'Maiquetía', 'Naiguatá', 'Urimare',
];

const noDuplicado = (p) => (p?.duplicate_of ?? p?.duplicateOf ?? null) === null;

const normalizeList = (res) => {
  if (Array.isArray(res)) return res;
  return res?.items || res?.data || res?.personas || [];
};

// Filtro cliente (solo se usa en modo mock; con API el server ya filtra).
const matchLocal = (p, { q, estado, parroquia }) => {
  if (estado && p.estado !== estado) return false;
  if (parroquia && (p.parroquia || '').toLowerCase() !== parroquia.toLowerCase()) return false;
  if (q) {
    const nom = (p.nombre_completo || p.nombre || '').toLowerCase();
    if (!nom.includes(q.toLowerCase())) return false;
  }
  return true;
};

export default function GaleriaDesaparecidos({
  onVerEnMapa,
  onVerCoincidencias,
  onIrHospitales,
  onIrMapa,
  q: qProp,
  setQ: setQProp,
  estado: estadoProp,
  setEstado: setEstadoProp,
  parroquia: parroquiaProp,
  setParroquia: setParroquiaProp,
}) {
  // Búsqueda y filtros pueden venir controlados desde el header (shell). Si no,
  // se usan los internos y se muestra la barra de controles propia.
  const controlado = qProp !== undefined;
  const [qI, setQI] = useState('');
  const [estadoI, setEstadoI] = useState('');
  const [parroquiaI, setParroquiaI] = useState('');
  const q = controlado ? qProp : qI;
  const setQ = controlado ? setQProp : setQI;
  const estado = controlado ? estadoProp : estadoI;
  const setEstado = controlado ? setEstadoProp : setEstadoI;
  const parroquia = controlado ? parroquiaProp : parroquiaI;
  const setParroquia = controlado ? setParroquiaProp : setParroquiaI;
  const qDebounced = useDebounce(q, 350);

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [source, setSource] = useState('api'); // api | mock
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(null); // total de reportes (meta del backend)
  const [cargando, setCargando] = useState(false); // hay un fetch en curso (evita cargas dobles)
  const reqId = useRef(0);
  const sentinelaRef = useRef(null);

  // Estadísticas del directorio (hero + chips). Fuente única: se calculan aquí y se
  // pasan como `vista` al hero y a los chips (fila móvil + rail desktop).
  const [statsDir, setStatsDir] = useState(null);
  // Token admin en la URL (?token=): el endpoint añade el conteo de fallecidos (gated).
  const token =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null;

  useEffect(() => {
    if (typeof api.intelStats !== 'function') return undefined;
    let vivo = true;
    const cargar = () =>
      api
        .intelStats(token || undefined)
        .then((res) => {
          if (vivo && res) setStatsDir(statsDesdeApi(res));
        })
        .catch(() => {});
    cargar();
    const id = setInterval(cargar, STATS_POLL_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [token]);

  const filtros = useMemo(
    () => ({ q: qDebounced.trim(), estado, parroquia }),
    [qDebounced, estado, parroquia],
  );

  // Resetear a página 1 cuando cambian los filtros.
  useEffect(() => {
    setPage(1);
  }, [filtros]);

  // Con q de 2+ caracteres se activa la búsqueda unificada (reportes+hospitales),
  // que hace su propio fetch; la grilla del directorio no carga en ese modo.
  const enBusqueda = filtros.q.trim().length >= 2;

  useEffect(() => {
    if (enBusqueda) return undefined;
    const id = ++reqId.current;
    let cancelado = false;
    const esPrimeraPagina = page === 1;
    if (esPrimeraPagina) setStatus('loading');
    setCargando(true);

    const aplicarMock = () => {
      if (cancelado || id !== reqId.current) return;
      const filtrados = mockDesaparecidos.filter(noDuplicado).filter((p) => matchLocal(p, filtros));
      setItems(filtrados);
      setTotal(filtrados.length);
      setHasMore(false);
      setSource('mock');
      setStatus('ready');
    };

    const cargar = async () => {
      if (typeof api.intelPersonas !== 'function') {
        aplicarMock();
        return;
      }
      try {
        const res = await api.intelPersonas({ ...filtros, page, limit: LIMIT });
        if (cancelado || id !== reqId.current) return;
        const raw = normalizeList(res);
        const batch = raw.filter(noDuplicado);
        setItems((prev) => (esPrimeraPagina ? batch : [...prev, ...batch]));
        // Backend devuelve meta { total, page, pages }: usamos pages para saber
        // si hay más. Si el meta no viene, caemos a la heurística (página llena).
        setHasMore(
          typeof res?.pages === 'number' ? page < res.pages : raw.length === LIMIT,
        );
        if (typeof res?.total === 'number') setTotal(res.total);
        setSource('api');
        setStatus('ready');
      } catch {
        if (cancelado || id !== reqId.current) return;
        // Si la primera página falla, mostramos mock; si falla "cargar más",
        // dejamos lo que ya hay y ocultamos el botón.
        if (esPrimeraPagina) aplicarMock();
        else { setHasMore(false); setStatus('ready'); }
      }
    };

    cargar().finally(() => {
      if (!cancelado && id === reqId.current) setCargando(false);
    });
    return () => { cancelado = true; };
  }, [filtros, page]);

  // Scroll infinito: cuando el sentinela del pie entra al viewport y hay más
  // páginas (y no hay un fetch en curso), avanza a la siguiente. El observer se
  // reconecta al cambiar hasMore/cargando (p. ej. tras un filtro), y el guard
  // `!cargando` evita disparar varias cargas a la vez.
  useEffect(() => {
    const el = sentinelaRef.current;
    if (!el || !hasMore) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !cargando) {
          setPage((n) => n + 1);
        }
      },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, cargando]);

  const parroquias = useMemo(() => {
    const set = new Set(PARROQUIAS_SEED);
    for (const p of items) if (p.parroquia) set.add(p.parroquia);
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [items]);

  const visibles = items; // ya filtrados (server o mock)
  const vacio = status === 'ready' && visibles.length === 0;

  // Cifras para el hero y los chips: endpoint si respondió, si no fallback sobre lo cargado.
  const vista = statsDir ?? statsDesdeItems(visibles);

  // Actualización optimista tras marcar a una persona (p. ej. a salvo): refleja
  // el cambio al instante sin recargar toda la lista.
  const handleUpdate = (id, patch) =>
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  // Click en una stat-card. Si el filtro ya está activo, resetea TODO (estado +
  // parroquia + buscador) -> "mostrar todos". Si es otro, aplica ese estado.
  const aplicarFiltroStat = (filtro) => {
    if (filtro === estado) {
      setEstado('');
      setParroquia('');
      setQ('');
    } else {
      setEstado(filtro);
    }
  };

  return (
    <section aria-label="Personas desaparecidas" className="mx-auto w-full max-w-6xl px-3 pb-3 pt-2 sm:px-4">
      <div className="lg:flex lg:items-start lg:gap-4">
        {/* Columna principal: hero + chips (móvil) + controles + galería. */}
        <div className="min-w-0 lg:flex-1">
      <EstadisticasDirectorio
        vista={vista}
        estado={estado}
        onEstado={aplicarFiltroStat}
        onIrHospitales={onIrHospitales}
        onIrMapa={onIrMapa}
        titulo={
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-base font-bold text-slate-900">Desaparecidos</span>
            {total != null && (
              <span className="text-xs font-semibold tabular-nums text-slate-500">
                {total} {total === 1 ? 'reporte' : 'reportes'}
              </span>
            )}
            {source === 'mock' && <span className="text-[10px] text-slate-400">(prueba)</span>}
          </span>
        }
        accion={
          onVerCoincidencias && (
            <button
              type="button"
              onClick={onVerCoincidencias}
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white shadow hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 sm:w-auto"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5"><path d="M16.5 6.5a4.5 4.5 0 0 0-3.5 1.68A4.5 4.5 0 1 0 7.5 15h.5v-2h-.5a2.5 2.5 0 1 1 2.45-3h2.1A4.5 4.5 0 1 0 16.5 6.5zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM9 11h6v2H9z" /></svg>
              Posibles reunificaciones
            </button>
          )
        }
      />

      {/* Controles (solo si NO viene controlado por el header del shell).
          Buscador + Estado + Parroquia en UNA sola fila compacta (igual al header). */}
      {!controlado && (
      <div role="search" aria-label="Buscar y filtrar desaparecidos" className="sticky top-0 z-10 -mx-3 mb-4 flex items-center gap-2 bg-slate-50/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
        <label htmlFor="desap-q" className="sr-only">Buscar por nombre</label>
        <input
          id="desap-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre…"
          className="min-w-0 flex-[2] rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:flex-1"
        />
        <label htmlFor="desap-estado" className="sr-only">Filtrar por estado</label>
        <select
          id="desap-estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-700 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:flex-none"
        >
          <option value="">Estado</option>
          {/* 'fallecido' excluido del filtro público (privacidad). */}
          {Object.entries(ESTADO_LABEL)
            .filter(([k]) => k !== 'fallecido')
            .map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
        </select>
        <label htmlFor="desap-parroquia" className="sr-only">Filtrar por parroquia</label>
        <select
          id="desap-parroquia"
          value={parroquia}
          onChange={(e) => setParroquia(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-700 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:flex-none"
        >
          <option value="">Parroquia</option>
          {parroquias.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      )}

      {enBusqueda ? (
        // Búsqueda unificada: reportes del directorio + coincidencias en hospitales.
        <BusquedaUnificada q={filtros.q} onUpdate={handleUpdate} onVerEnMapa={onVerEnMapa} />
      ) : (
        <>
          {/* Estados accesibles */}
          <div aria-live="polite" className="min-h-[1.25rem]">
            {status === 'loading' && (
              <p className="py-8 text-center text-sm text-slate-500">Cargando reportes…</p>
            )}
            {status === 'error' && (
              <p className="py-8 text-center text-sm text-red-600">No se pudieron cargar los reportes.</p>
            )}
            {vacio && (
              <p className="py-8 text-center text-sm text-slate-500">
                No hay personas que coincidan con la búsqueda.
              </p>
            )}
          </div>

          {/* Grilla */}
          {visibles.length > 0 && (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {visibles.map((p) => (
                <li key={p.id ?? `${p.nombre_completo}-${p.fecha_reporte}`}>
                  <DesaparecidoCard persona={p} onUpdate={handleUpdate} onVerEnMapa={onVerEnMapa} />
                </li>
              ))}
            </ul>
          )}

          {/* Sentinela del scroll infinito + indicador de carga de más páginas. */}
          {hasMore && <div ref={sentinelaRef} aria-hidden="true" className="h-px w-full" />}

          {cargando && visibles.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500" aria-live="polite">
              <svg className="h-4 w-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
              Cargando más…
            </div>
          )}
        </>
      )}
        </div>

        {/* Rail vertical de chips de filtro: SOLO desktop (lg+), en el margen blanco
            derecho. Siguen siendo clickeables como filtros de estado. */}
        <aside aria-label="Filtros por estado" className="hidden shrink-0 lg:block lg:w-44">
          <div className="sticky top-2">
            <ChipsEstado
              orientacion="col"
              vista={vista}
              estado={estado}
              onEstado={aplicarFiltroStat}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}
