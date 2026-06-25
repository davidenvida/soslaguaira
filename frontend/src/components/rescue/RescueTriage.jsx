import { useCallback, useEffect, useState } from 'react';
import { wazeUrl, googleMapsUrl, formatCoords } from './mapsLinks';
import { mockListAtrapados, mockUpdateAtrapado, ordenarPorUrgencia } from './mockData';

/**
 * Panel de TRIAJE para rescatistas.
 * Lista priorizada de atrapados (urgencia primero) con coordenadas, piso,
 * cantidad de personas y navegación directa a Waze y Google Maps.
 *
 * Props (mock-first):
 *  - fetchAtrapados(params) => Promise<Atrapado[]>   -> api.js listAtrapados. Default: mock.
 *  - updateEstado(id, { estado }) => Promise<Atrapado> -> api.js updateAtrapado. Default: mock.
 *  - onVerEnMapa(atrapado) -> opcional, centrar el mapa principal en el punto.
 *  - pollMs -> refresco automático (ms). 0 = sin auto-refresh. Default 0.
 */
export default function RescueTriage({
  fetchAtrapados = mockListAtrapados,
  updateEstado = mockUpdateAtrapado,
  onVerEnMapa,
  pollMs = 0,
}) {
  const [items, setItems] = useState([]);
  const [filtro, setFiltro] = useState(''); // '' = activos (atrapado+en_rescate)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actualizando, setActualizando] = useState(null);

  const cargar = useCallback(() => {
    let activo = true;
    setLoading(true);
    setError(null);
    fetchAtrapados({ estado: filtro })
      .then((data) => {
        if (!activo) return;
        setItems(ordenarPorUrgencia(Array.isArray(data) ? data : []));
      })
      .catch(() => activo && setError('No se pudo cargar la lista. Reintenta.'))
      .finally(() => activo && setLoading(false));
    return () => { activo = false; };
  }, [fetchAtrapados, filtro]);

  useEffect(() => cargar(), [cargar]);

  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(cargar, pollMs);
    return () => clearInterval(id);
  }, [pollMs, cargar]);

  async function cambiarEstado(item, estado) {
    setActualizando(item.id);
    try {
      await updateEstado(item.id, { estado });
      setItems((prev) =>
        ordenarPorUrgencia(prev.map((it) => (it.id === item.id ? { ...it, estado } : it)))
      );
    } catch {
      setError('No se pudo actualizar el estado.');
    } finally {
      setActualizando(null);
    }
  }

  const visibles = filtro
    ? items
    : items.filter((i) => i.estado === 'atrapado' || i.estado === 'en_rescate');

  // Cuenta personas por rescatar. Los casos de intel suelen tener cantidad_personas NULL:
  // se cuenta al menos 1 por caso para NO mostrar 0 cuando hay atrapados activos.
  const totalPersonas = visibles
    .filter((i) => i.estado === 'atrapado' || i.estado === 'en_rescate')
    .reduce((acc, i) => acc + (i.cantidad_personas || 1), 0);

  return (
    <section className="w-full max-w-2xl mx-auto p-3 sm:p-4" aria-label="Triaje de rescate">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Triaje de rescate</h2>
          <p className="text-xs text-slate-500">
            {totalPersonas} persona{totalPersonas === 1 ? '' : 's'} por rescatar
          </p>
        </div>
        <button
          type="button"
          onClick={cargar}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-50"
        >
          Actualizar
        </button>
      </header>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {[
          { v: '', t: 'Activos' },
          { v: 'atrapado', t: 'Atrapados' },
          { v: 'en_rescate', t: 'En rescate' },
          { v: 'rescatado', t: 'Rescatados' },
        ].map((f) => (
          <button
            key={f.v}
            type="button"
            onClick={() => setFiltro(f.v)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filtro === f.v ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {f.t}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {loading && <p className="py-6 text-center text-sm text-slate-500" role="status">Cargando…</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!loading && !error && visibles.length === 0 && (
          <p className="rounded-lg bg-emerald-50 px-3 py-6 text-center text-sm text-emerald-700">
            No hay casos en esta categoría.
          </p>
        )}

        <ul className="space-y-3">
          {visibles.map((a, idx) => (
            <TriageCard
              key={a.id}
              a={a}
              orden={idx + 1}
              actualizando={actualizando === a.id}
              onVerEnMapa={onVerEnMapa}
              onCambiarEstado={cambiarEstado}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

const ESTADO_META = {
  atrapado: { label: 'Atrapado', card: 'border-red-300 bg-red-50', dot: 'bg-red-500', badge: 'bg-red-100 text-red-800' },
  en_rescate: { label: 'En rescate', card: 'border-amber-300 bg-amber-50', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
  rescatado: { label: 'Rescatado', card: 'border-emerald-200 bg-white', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
  fallecido: { label: 'Fallecido', card: 'border-slate-300 bg-white', dot: 'bg-slate-500', badge: 'bg-slate-200 text-slate-700' },
};

function TriageCard({ a, orden, actualizando, onVerEnMapa, onCambiarEstado }) {
  const meta = ESTADO_META[a.estado] || ESTADO_META.atrapado;
  const navegable = a.lat != null && a.lng != null;

  return (
    <li className={`rounded-2xl border p-3 shadow-sm ${meta.card}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-800 text-sm font-bold text-white">
          {orden}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
            <span className="ml-auto text-sm font-bold text-slate-800">
              {a.cantidad_personas != null
                ? `${a.cantidad_personas} ${Number(a.cantidad_personas) === 1 ? 'persona' : 'personas'}`
                : '? personas'}
            </span>
          </div>

          <p className="mt-1.5 font-semibold text-slate-800">
            {a.edificio || 'Sin edificio'}{a.piso != null ? ` · Piso ${a.piso}` : ''}
          </p>
          {a.direccion && <p className="text-sm text-slate-600">{a.direccion}</p>}
          {a.descripcion && <p className="mt-1 text-sm text-slate-700">{a.descripcion}</p>}

          <p className="mt-1.5 font-mono text-xs text-slate-500">
            📍 {formatCoords(a.lat, a.lng)}
          </p>
        </div>
      </div>

      {navegable && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={wazeUrl(a.lat, a.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-sky-600 px-3 py-2.5 text-center text-sm font-semibold text-white active:bg-sky-700"
          >
            Navegar con Waze
          </a>
          <a
            href={googleMapsUrl(a.lat, a.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-sm font-semibold text-white active:bg-emerald-700"
          >
            Google Maps
          </a>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {a.contacto && (
          <a
            href={`tel:${String(a.contacto).replace(/[^+\d]/g, '')}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 active:bg-slate-50"
          >
            Llamar contacto
          </a>
        )}
        {onVerEnMapa && navegable && (
          <button
            type="button"
            onClick={() => onVerEnMapa(a)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 active:bg-slate-50"
          >
            Ver en mapa
          </button>
        )}

        {a.estado === 'atrapado' && (
          <button
            type="button"
            disabled={actualizando}
            onClick={() => onCambiarEstado(a, 'en_rescate')}
            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white active:bg-amber-600 disabled:opacity-50"
          >
            {actualizando ? '…' : 'Marcar en rescate'}
          </button>
        )}
        {(a.estado === 'atrapado' || a.estado === 'en_rescate') && (
          <button
            type="button"
            disabled={actualizando}
            onClick={() => onCambiarEstado(a, 'rescatado')}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
          >
            {actualizando ? '…' : 'Marcar rescatado'}
          </button>
        )}
      </div>
    </li>
  );
}
