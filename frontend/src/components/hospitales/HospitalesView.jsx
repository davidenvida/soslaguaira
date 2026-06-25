// Sección HOSPITALES: al entrar, muestra de frente la LISTA de pacientes
// (ingresados/trasladados/heridos; fallecidos fuera). Columnas: Nombre, Cédula,
// Hospital y Coincidencia (verde = coincide con un reporte del directorio, gris =
// sin coincidencia). Botones de hospital arriba (Todos + cada uno) que filtran la
// lista; el buscador filtra DENTRO de la lista por nombre o cédula. Pública.
import { useEffect, useMemo, useState } from 'react';
import http from '../../api';

const unwrap = (r) => r.data?.data ?? r.data;

// data = { items:[{ nombre, cedula, hospital, estado, lugar, coincidencia:{hay, reporte} }],
//          total, ..., hospitales:[{hospital,total,tipos}] }  (hospitales para los botones).
const fetchPersonas = (hospital) =>
  http
    .get('/hospitales/personas', {
      params: { ...(hospital && hospital !== 'todos' ? { hospital } : {}), limit: 500 },
    })
    .then(unwrap);

// Coincidencia con un reporte del directorio: it.coincidencia.hay (bool).
const coincide = (p) => Boolean(p?.coincidencia?.hay);

export default function HospitalesView() {
  const [hospitales, setHospitales] = useState([]);
  const [sel, setSel] = useState('todos');
  const [personas, setPersonas] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [q, setQ] = useState('');

  useEffect(() => {
    let vivo = true;
    setStatus('loading');
    fetchPersonas(sel)
      .then((data) => {
        if (!vivo) return;
        setPersonas(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []);
        // Los botones de hospital vienen en la misma respuesta.
        if (Array.isArray(data?.hospitales) && data.hospitales.length) setHospitales(data.hospitales);
        setStatus('ready');
      })
      .catch(() => vivo && setStatus('error'));
    return () => {
      vivo = false;
    };
  }, [sel]);

  const totalTodos = useMemo(() => hospitales.reduce((a, h) => a + (h.total || 0), 0), [hospitales]);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return personas;
    return personas.filter(
      (p) =>
        (p.nombre || '').toLowerCase().includes(t) ||
        String(p.cedula || '').toLowerCase().includes(t),
    );
  }, [personas, q]);

  return (
    <section aria-label="Hospitales" className="mx-auto flex h-full w-full max-w-4xl flex-col px-3 pb-2 pt-3 sm:px-4">
      {/* Título + dropdown de hospital a la derecha, en la misma línea (libera alto). */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="shrink-0 text-base font-bold text-slate-900">Hospitales</h2>
        <label htmlFor="hosp-sel" className="sr-only">Filtrar por hospital</label>
        <select
          id="hosp-sel"
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          className="min-w-0 max-w-[70%] rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="todos">Todos{totalTodos ? ` (${totalTodos})` : ''}</option>
          {hospitales.map((h) => (
            <option key={h.hospital} value={h.hospital}>
              {h.hospital}{h.total != null ? ` (${h.total})` : ''}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Personas ingresadas, trasladadas o heridas reportadas por los hospitales. Verde = coincide con un reporte del directorio.
      </p>

      {/* Buscador dentro de la lista */}
      <label htmlFor="hosp-q" className="sr-only">Buscar por nombre o cédula</label>
      <input
        id="hosp-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o cédula…"
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
      />

      {/* Lista / tabla scrollable */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl ring-1 ring-slate-200" aria-live="polite">
        {status === 'loading' && <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>}
        {status === 'error' && <p className="py-8 text-center text-sm text-red-600">No se pudo cargar la lista.</p>}
        {status === 'ready' && filtradas.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No hay personas que coincidan.</p>
        )}
        {status === 'ready' && filtradas.length > 0 && (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Nombre</th>
                <th className="px-3 py-2 font-semibold">Cédula</th>
                <th className="px-3 py-2 font-semibold">Hospital</th>
                <th className="px-3 py-2 font-semibold">Coincidencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map((p, i) => (
                <tr key={p.id ?? `${p.cedula}-${i}`} className="bg-white">
                  <td className="px-3 py-2 font-medium text-slate-900">{p.nombre || '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">{p.cedula || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{p.hospital || '—'}</td>
                  <td className="px-3 py-2">
                    {coincide(p) ? (
                      <span className="inline-block whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        Coincide con un reporte
                      </span>
                    ) : (
                      <span className="inline-block whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        Sin coincidencia
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
