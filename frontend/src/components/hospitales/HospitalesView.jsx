// Sección HOSPITALES: al entrar, muestra de frente la LISTA de pacientes
// (ingresados/trasladados/heridos; fallecidos fuera). Columnas: Nombre, Cédula,
// Hospital y Coincidencia (verde = coincide con un reporte del directorio, gris =
// sin coincidencia). Botones de hospital arriba (Todos + cada uno) que filtran la
// lista; el buscador filtra DENTRO de la lista por nombre o cédula. Pública.
import { Fragment, useEffect, useMemo, useState } from 'react';
import http, { fotoUrl as toBackendUrl } from '../../api';
import PersonaDetalle from '../desaparecidos/PersonaDetalle';
import Lightbox from '../ui/Lightbox';

// Nombre de la lista específica (fuente) y la imagen del cartel original.
const listaNombre = (p) => p?.lista?.fuente || p?.lista_fuente || p?.fuente || '';
const listaFoto = (p) => toBackendUrl(p?.lista?.foto_url || p?.lista_foto_url || p?.foto_url || '');

const unwrap = (r) => r.data?.data ?? r.data;

// data = { items:[{ nombre, cedula, hospital, estado, lugar, coincidencia:{hay, reporte} }],
//          total, ..., hospitales:[{hospital,total,tipos}] }  (hospitales para los botones).
const fetchPersonas = (hospital, coinc) =>
  http
    .get('/hospitales/personas', {
      params: {
        ...(hospital && hospital !== 'todos' ? { hospital } : {}),
        ...(coinc === 'con' || coinc === 'sin' ? { coincidencia: coinc } : {}),
        limit: 500,
      },
    })
    .then(unwrap);

// Coincidencia con un reporte del directorio: it.coincidencia.hay (bool).
const coincide = (p) => Boolean(p?.coincidencia?.hay);
const reporteId = (p) => p?.coincidencia?.reporte?.id;

export default function HospitalesView({ coincInicial }) {
  const [hospitales, setHospitales] = useState([]);
  const [sel, setSel] = useState('todos');
  const [personas, setPersonas] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [q, setQ] = useState('');
  // Arranca en 'con' si se entró desde "Posibles reunificaciones".
  const [coincFiltro, setCoincFiltro] = useState(() => (coincInicial === 'con' ? 'con' : 'todas')); // todas | con | sin
  const [detalle, setDetalle] = useState(null); // reporte abierto (PersonaDetalle)
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [imgLista, setImgLista] = useState(null); // imagen del cartel de la lista (Lightbox)
  const [expandido, setExpandido] = useState(() => new Set()); // filas expandidas en móvil

  const toggleExp = (k) =>
    setExpandido((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  useEffect(() => {
    let vivo = true;
    setStatus('loading');
    fetchPersonas(sel, coincFiltro)
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
  }, [sel, coincFiltro]);

  const totalTodos = useMemo(() => hospitales.reduce((a, h) => a + (h.total || 0), 0), [hospitales]);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return personas.filter((p) => {
      // Filtro de coincidencia (además del param del server, por seguridad).
      if (coincFiltro === 'con' && !coincide(p)) return false;
      if (coincFiltro === 'sin' && coincide(p)) return false;
      if (!t) return true;
      return (p.nombre || '').toLowerCase().includes(t) || String(p.cedula || '').toLowerCase().includes(t);
    });
  }, [personas, q, coincFiltro]);

  // Abre el reporte del desaparecido que matcheó (acción de reunificación).
  const abrirReporte = async (p) => {
    const id = reporteId(p);
    if (id == null || cargandoReporte) return;
    setCargandoReporte(true);
    try {
      const persona = await http.get(`/intel/personas/${id}`).then(unwrap);
      setDetalle(persona || { id, ...(p.coincidencia?.reporte || {}) });
    } catch {
      // Fallback: abre con lo poco que trae la coincidencia.
      setDetalle({ id, ...(p.coincidencia?.reporte || {}) });
    } finally {
      setCargandoReporte(false);
    }
  };

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
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
      />

      {/* Filtro de coincidencia: botones (no dropdown). */}
      <div role="group" aria-label="Filtrar por coincidencia" className="mb-3 flex gap-2">
        {[
          { v: 'todas', label: 'Todas' },
          { v: 'con', label: 'Con coincidencia' },
          { v: 'sin', label: 'Sin coincidencia' },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setCoincFiltro(o.v)}
            aria-pressed={coincFiltro === o.v}
            className={`min-h-[36px] flex-1 rounded-full px-3 text-xs font-semibold ring-1 transition sm:flex-none ${
              coincFiltro === o.v ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Aviso: los matches son por NOMBRE (candidatos), no confirmados. */}
      {coincFiltro === 'con' && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200" role="note">
          ⚠ POSIBLES coincidencias por nombre — verificar antes de avisar a la familia.
        </p>
      )}

      {/* Lista de pacientes: cards en móvil, tabla completa en desktop. */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl ring-1 ring-slate-200" aria-live="polite">
        {status === 'loading' && <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>}
        {status === 'error' && <p className="py-8 text-center text-sm text-red-600">No se pudo cargar la lista.</p>}
        {status === 'ready' && filtradas.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No hay personas que coincidan.</p>
        )}

        {/* MÓVIL: cada paciente como card (prioridad: nombre, cédula, coincidencia). */}
        {status === 'ready' && filtradas.length > 0 && (
          <ul className="divide-y divide-slate-100 sm:hidden">
            {filtradas.map((p, i) => {
              const key = p.id ?? `${p.cedula}-${i}`;
              const clickable = coincide(p);
              const open = expandido.has(key);
              return (
                <li key={key} className="p-3">
                  <div className="flex items-center gap-2">
                    {clickable ? (
                      <button type="button" onClick={() => abrirReporte(p)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-semibold text-slate-900">{p.nombre || '—'}</span>
                      </button>
                    ) : (
                      <span className="block min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{p.nombre || '—'}</span>
                    )}
                    {clickable ? (
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">✓ Coincide</span>
                    ) : (
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Sin match</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleExp(key)}
                      aria-expanded={open}
                      aria-controls={`hd-${key}`}
                      aria-label="Ver hospital y lista"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                    >
                      <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-0.5 text-xs tabular-nums text-slate-500">{p.cedula || '—'}</div>
                  {open && (
                    <div id={`hd-${key}`} className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                      <div><span className="font-semibold text-slate-500">Hospital: </span>{p.hospital || '—'}</div>
                      <div><span className="font-semibold text-slate-500">Lista: </span>{listaNombre(p) || '—'}</div>
                      {listaFoto(p) && (
                        <button type="button" onClick={() => setImgLista(listaFoto(p))} className="font-semibold text-indigo-600 hover:underline">
                          Ver imagen del cartel
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* DESKTOP: tabla completa. */}
        {status === 'ready' && filtradas.length > 0 && (
          <table className="hidden w-full text-left text-sm sm:table">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Nombre</th>
                <th className="px-3 py-2 font-semibold">Cédula</th>
                <th className="px-3 py-2 font-semibold">Hospital</th>
                <th className="px-3 py-2 font-semibold">Lista</th>
                <th className="px-3 py-2 font-semibold">Coincidencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map((p, i) => {
                const clickable = coincide(p);
                return (
                  <tr
                    key={p.id ?? `${p.cedula}-${i}`}
                    onClick={clickable ? () => abrirReporte(p) : undefined}
                    {...(clickable
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          'aria-label': `Ver reporte de ${p.nombre || 'la persona'}`,
                          onKeyDown: (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              abrirReporte(p);
                            }
                          },
                        }
                      : {})}
                    className={`bg-white ${clickable ? 'cursor-pointer hover:bg-emerald-50' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">{p.nombre || '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-600">{p.cedula || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{p.hospital || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">
                      <div className="min-w-0">
                        <span className="block truncate">{listaNombre(p) || '—'}</span>
                        {listaFoto(p) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImgLista(listaFoto(p));
                            }}
                            className="mt-0.5 text-[11px] font-semibold text-indigo-600 hover:underline"
                          >
                            Ver imagen
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {clickable ? (
                        <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Coincide con un reporte <span aria-hidden="true">›</span>
                        </span>
                      ) : (
                        <span className="inline-block whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          Sin coincidencia
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {detalle && <PersonaDetalle persona={detalle} onClose={() => setDetalle(null)} />}
      {imgLista && <Lightbox src={imgLista} alt="Imagen original de la lista" caption="Lista original" onClose={() => setImgLista(null)} />}
    </section>
  );
}
