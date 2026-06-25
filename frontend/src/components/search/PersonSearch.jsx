import { useEffect, useState } from 'react';
import useDebounce from './useDebounce';
import { mockSearchPersonas, estadoLabel } from './mockData';

/**
 * Buscador de personas por nombre, estado y zona, con debounce.
 *
 * Props (todas opcionales — mock-first):
 *  - searchFn({ q, estado, tipo }) => Promise<Persona[]>
 *      Cablear con api.js -> listPersonas. Devuelve el array directo. Default: mock.
 *  - onSelect(persona)  -> callback al tocar un resultado (ej: abrir MatchView / centrar mapa).
 *  - title              -> título opcional de la sección.
 */
export default function PersonSearch({ searchFn = mockSearchPersonas, onSelect, title = 'Buscar persona' }) {
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const qDebounced = useDebounce(q, 400);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setError(null);
    searchFn({ q: qDebounced, estado, tipo })
      .then((data) => {
        if (!activo) return;
        setResultados(Array.isArray(data) ? data : []);
      })
      .catch(() => activo && setError('Error de conexión. Reintenta.'))
      .finally(() => activo && setLoading(false));
    return () => {
      activo = false;
    };
  }, [qDebounced, estado, tipo, searchFn]);

  return (
    <section className="w-full max-w-xl mx-auto p-3 sm:p-4" aria-label="Buscador de personas">
      <h2 className="text-lg font-bold text-slate-800 mb-3">{title}</h2>

      <label htmlFor="person-search-q" className="sr-only">Nombre de la persona</label>
      <div className="relative">
        <input
          id="person-search-q"
          type="search"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre o apellido…"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base
                     focus:outline-none focus:ring-2 focus:ring-sky-500"
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" role="status">
            Buscando…
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="person-search-estado" className="sr-only">Filtrar por estado</label>
          <select
            id="person-search-estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todos los estados</option>
            <option value="desaparecido">Desaparecido</option>
            <option value="a_salvo">A salvo</option>
            <option value="herido">Herido</option>
            <option value="visto_con_vida">Visto con vida</option>
            <option value="fallecido">Fallecido</option>
            <option value="desconocido">Desconocido</option>
          </select>
        </div>
        <div>
          <label htmlFor="person-search-tipo" className="sr-only">Filtrar por tipo de reporte</label>
          <select
            id="person-search-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Busco y reporto</option>
            <option value="busco">Busco a alguien</option>
            <option value="reporto">Reporto a salvo</option>
          </select>
        </div>
      </div>

      <div className="mt-4" aria-live="polite">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {!error && !loading && resultados.length === 0 && (
          <p className="text-sm text-slate-500 py-6 text-center">Sin resultados.</p>
        )}

        <ul className="divide-y divide-slate-100">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect?.(p)}
                className="w-full text-left flex items-center gap-3 py-3 px-1 active:bg-slate-50 rounded-lg"
              >
                <Avatar persona={p} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-800 truncate">{p.nombre}</span>
                  <span className="block text-xs text-slate-500 truncate">
                    {p.edad ? `${p.edad} años · ` : ''}{p.direccion || 'Ubicación no indicada'}
                  </span>
                </span>
                <EstadoBadge estado={p.estado} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Avatar({ persona }) {
  if (persona.foto_url) {
    return (
      <img
        src={persona.foto_url}
        alt={`Foto de ${persona.nombre}`}
        className="h-11 w-11 rounded-full object-cover bg-slate-100 shrink-0"
        loading="lazy"
      />
    );
  }
  const iniciales = persona.nombre.split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="h-11 w-11 rounded-full bg-slate-200 text-slate-600 grid place-items-center text-sm font-semibold shrink-0"
    >
      {iniciales}
    </span>
  );
}

const ESTADO_COLOR = {
  desaparecido: 'bg-amber-100 text-amber-800',
  a_salvo: 'bg-emerald-100 text-emerald-800',
  herido: 'bg-orange-100 text-orange-800',
  visto_con_vida: 'bg-sky-100 text-sky-800',
  fallecido: 'bg-slate-200 text-slate-700',
  desconocido: 'bg-slate-100 text-slate-600',
};

export function EstadoBadge({ estado }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_COLOR[estado] || ESTADO_COLOR.desconocido}`}>
      {estadoLabel(estado)}
    </span>
  );
}
