// Sección HOSPITALES: botones de cada hospital + buscador por nombre o cédula.
// Pública (sin token), excluye fallecidos. Una familia entra, elige un hospital
// (o "Todos") y busca a su ser querido entre los ingresados/trasladados/heridos.
import { useEffect, useState } from 'react';
import http from '../../api';
import useDebounce from '../search/useDebounce';
import { ESTADO_LISTA } from '../listas/listasUtils';

const unwrap = (r) => r.data?.data ?? r.data;
const fetchHospitales = () => http.get('/hospitales').then(unwrap);
const buscar = (q, hospital) =>
  http.get('/hospitales/buscar', { params: { q, hospital } }).then(unwrap);

const arr = (x) => (Array.isArray(x) ? x : x?.items || x?.data || []);

export default function HospitalesView() {
  const [hospitales, setHospitales] = useState([]);
  const [sel, setSel] = useState('todos'); // nombre del hospital | 'todos'
  const [q, setQ] = useState('');
  const qd = useDebounce(q, 350);
  const [resultados, setResultados] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error

  useEffect(() => {
    let vivo = true;
    fetchHospitales()
      .then((r) => vivo && setHospitales(arr(r)))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const query = qd.trim();
    if (query.length < 2) {
      setResultados([]);
      setStatus('idle');
      return undefined;
    }
    let vivo = true;
    setStatus('loading');
    buscar(query, sel)
      .then((r) => {
        if (vivo) {
          setResultados(arr(r));
          setStatus('ready');
        }
      })
      .catch(() => vivo && setStatus('error'));
    return () => {
      vivo = false;
    };
  }, [qd, sel]);

  return (
    <section aria-label="Hospitales" className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-3 pb-6 pt-3 sm:px-4">
      <h2 className="text-base font-bold text-slate-900">Hospitales</h2>
      <p className="mb-3 text-xs text-slate-500">
        Busca a tu familiar entre las personas ingresadas, trasladadas o heridas reportadas por los hospitales.
      </p>

      {/* Botones de hospital */}
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSel('todos')}
          aria-pressed={sel === 'todos'}
          className={`min-h-[36px] rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            sel === 'todos' ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
          }`}
        >
          Todos los hospitales
        </button>
        {hospitales.map((h) => (
          <button
            key={h.hospital}
            type="button"
            onClick={() => setSel(h.hospital)}
            aria-pressed={sel === h.hospital}
            className={`min-h-[36px] rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
              sel === h.hospital ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {h.hospital}
            {h.total != null && <span className="ml-1 opacity-70">({h.total})</span>}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <label htmlFor="hosp-q" className="sr-only">Buscar por nombre o cédula</label>
      <input
        id="hosp-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o cédula…"
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
      />

      <div aria-live="polite">
        {q.trim().length > 0 && q.trim().length < 2 && (
          <p className="text-xs text-slate-400">Escribe al menos 2 caracteres.</p>
        )}
        {status === 'loading' && <p className="py-6 text-center text-sm text-slate-500">Buscando…</p>}
        {status === 'error' && <p className="py-6 text-center text-sm text-red-600">No se pudo buscar. Intenta de nuevo.</p>}
        {status === 'ready' && resultados.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">No se encontró a esa persona en los hospitales.</p>
        )}
        {status === 'ready' && resultados.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-200">
            {resultados.map((r, i) => (
              <li key={i} className="flex items-start gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{r.nombre || '—'}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {r.cedula && <span className="tabular-nums">C.I. {r.cedula}</span>}
                    {r.hospital && <span className="font-medium text-slate-600">{r.hospital}</span>}
                    {r.lugar && <span>{r.lugar}</span>}
                  </div>
                </div>
                {r.estado && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ESTADO_LISTA[r.estado] || ESTADO_LISTA.desconocido}`}>
                    {r.estado}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
