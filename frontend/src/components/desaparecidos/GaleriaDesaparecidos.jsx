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
import { ESTADO_LABEL } from './estados';
import { mockDesaparecidos } from './mockDesaparecidos';

const LIMIT = 30;

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

export default function GaleriaDesaparecidos({ onVerEnMapa }) {
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [parroquia, setParroquia] = useState('');
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

  const filtros = useMemo(
    () => ({ q: qDebounced.trim(), estado, parroquia }),
    [qDebounced, estado, parroquia],
  );

  // Resetear a página 1 cuando cambian los filtros.
  useEffect(() => {
    setPage(1);
  }, [filtros]);

  useEffect(() => {
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
    <section aria-label="Personas desaparecidas" className="mx-auto w-full max-w-6xl p-3 sm:p-4">
      <header className="mb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">Desaparecidos</h2>
          {total != null && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
              {total} {total === 1 ? 'reporte' : 'reportes'}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Reportes recopilados de redes y fuentes públicas. {source === 'mock' && '(datos de prueba)'}
        </p>
      </header>

      <EstadisticasDirectorio items={visibles} estado={estado} onEstado={aplicarFiltroStat} />

      {/* Controles */}
      <div role="search" aria-label="Buscar y filtrar desaparecidos" className="sticky top-0 z-10 -mx-3 mb-4 flex flex-col gap-2 bg-slate-50/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:flex-row sm:px-4">
        <div className="flex-1">
          <label htmlFor="desap-q" className="sr-only">Buscar por nombre</label>
          <input
            id="desap-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="desap-estado" className="sr-only">Filtrar por estado</label>
            <select
              id="desap-estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-700 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="desap-parroquia" className="sr-only">Filtrar por parroquia</label>
            <select
              id="desap-parroquia"
              value={parroquia}
              onChange={(e) => setParroquia(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-700 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="">Todas las parroquias</option>
              {parroquias.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

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
    </section>
  );
}
