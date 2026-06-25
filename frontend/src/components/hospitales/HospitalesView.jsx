// Sección HOSPITALES: al entrar, muestra de frente la LISTA de pacientes
// (ingresados/trasladados/heridos; fallecidos fuera). Columnas: Nombre, Cédula,
// Hospital y Coincidencia (verde = coincide con un reporte del directorio, gris =
// sin coincidencia). Botones de hospital arriba (Todos + cada uno) que filtran la
// lista; el buscador filtra DENTRO de la lista por nombre o cédula. Pública.
import { Fragment, useEffect, useMemo, useState } from 'react';
import http from '../../api';
import PersonaDetalle from '../desaparecidos/PersonaDetalle';
import ListaImagenModal from '../listas/ListaImagenModal';

// Token admin (?token=) para marcar 'informado a la familia' (acción del equipo).
const tokenDeUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get('token') || '';
  } catch {
    return '';
  }
};

// Lista de origen del paciente: id, nombre (fuente), si tiene imagen, y la publicación.
const listaId = (p) => p?.lista_id ?? p?.lista?.id ?? null;
const listaNombre = (p) => p?.lista?.fuente || p?.lista_fuente || p?.fuente || '';
const listaTieneFoto = (p) => Boolean(p?.lista?.foto_url || p?.lista_foto_url || p?.foto_url);
const listaFuenteUrl = (p) => p?.lista?.fuente_url || p?.lista_fuente_url || p?.fuente_url || '';

// Estado "informado a la familia" del reporte que matcheó.
const informadoFamilia = (p) => Boolean(p?.coincidencia?.reporte?.informado_familia);
const informadoVia = (p) => p?.coincidencia?.reporte?.informado_via || '';

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

// Estado "¿Informado a la familia?" + (si admin) botones para marcar la vía.
function InformadoControl({ p, esAdmin, onSet }) {
  if (!coincide(p)) return <span className="text-slate-300">—</span>;
  const inf = informadoFamilia(p);
  const via = informadoVia(p);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {inf ? (
        <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
          Sí{via ? ` · ${via}` : ''}
        </span>
      ) : (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">No</span>
      )}
      {esAdmin &&
        (inf ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onSet(p, false); }} className="text-[10px] text-slate-400 hover:underline">
            desmarcar
          </button>
        ) : (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); onSet(p, true, 'telefono'); }} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200">
              Tel
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onSet(p, true, 'publicacion'); }} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200">
              Pub
            </button>
          </>
        ))}
    </div>
  );
}

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
  const [verImagen, setVerImagen] = useState(null); // { listaId, fuenteUrl } -> modal con gate
  const [expandido, setExpandido] = useState(() => new Set()); // filas expandidas en móvil
  const token = tokenDeUrl();
  const esAdmin = !!token;

  // Marca/desmarca 'informado a la familia' (admin). Actualiza optimista la lista.
  const setInformado = async (p, valor, via) => {
    const rid = p?.coincidencia?.reporte?.id;
    if (rid == null) return;
    const body = valor ? { informado_familia: true, informado_via: via } : { informado_familia: false };
    setPersonas((prev) =>
      prev.map((x) =>
        x?.coincidencia?.reporte?.id === rid
          ? { ...x, coincidencia: { ...x.coincidencia, reporte: { ...x.coincidencia.reporte, informado_familia: valor, informado_via: valor ? via : null } } }
          : x,
      ),
    );
    try {
      await http.patch(`/intel/personas/${rid}`, body, { headers: { 'X-Admin-Token': token } });
    } catch {
      // si falla, recarga para volver al estado real
      setPersonas((prev) => [...prev]);
    }
  };

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
      {/* Cabecera en UNA fila en desktop (título + dropdown + filtros + buscador);
          en móvil apila. El subtítulo va debajo, chico. */}
      <div className="mb-1 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        {/* Título + dropdown de hospital, pegados */}
        <div className="flex items-center gap-2 lg:shrink-0">
          <h2 className="shrink-0 text-base font-bold text-slate-900">Hospitales</h2>
          <label htmlFor="hosp-sel" className="sr-only">Filtrar por hospital</label>
          <select
            id="hosp-sel"
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 lg:flex-none lg:max-w-[14rem]"
          >
            <option value="todos">Todos{totalTodos ? ` (${totalTodos})` : ''}</option>
            {hospitales.map((h) => (
              <option key={h.hospital} value={h.hospital}>
                {h.hospital}{h.total != null ? ` (${h.total})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro de coincidencia: botones (no dropdown). */}
        <div role="group" aria-label="Filtrar por coincidencia" className="flex gap-2 lg:shrink-0">
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
              className={`min-h-[36px] flex-1 rounded-full px-3 text-xs font-semibold ring-1 transition lg:flex-none ${
                coincFiltro === o.v ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Buscador dentro de la lista */}
        <label htmlFor="hosp-q" className="sr-only">Buscar por nombre o cédula</label>
        <input
          id="hosp-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o cédula…"
          className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 lg:flex-1"
        />
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Personas ingresadas, trasladadas o heridas reportadas por los hospitales. Verde = coincide con un reporte del directorio.
      </p>

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
          <ul className="divide-y divide-slate-100 md:hidden">
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
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                    >
                      <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs tabular-nums text-slate-500">
                    {p.cedula || '—'}
                    {clickable && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] not-italic">
                        <span className="text-slate-400">Informado:</span>
                        <InformadoControl p={p} esAdmin={esAdmin} onSet={setInformado} />
                      </span>
                    )}
                  </div>
                  {open && (
                    <div id={`hd-${key}`} className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                      <div><span className="font-semibold text-slate-500">Hospital: </span>{p.hospital || '—'}</div>
                      <div><span className="font-semibold text-slate-500">Lista: </span>{listaNombre(p) || '—'}</div>
                      {listaTieneFoto(p) && listaId(p) != null && (
                        <button
                          type="button"
                          onClick={() => setVerImagen({ listaId: listaId(p), fuenteUrl: listaFuenteUrl(p) })}
                          className="font-semibold text-indigo-600 hover:underline"
                        >
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
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Nombre</th>
                <th className="px-3 py-2 font-semibold">Cédula</th>
                <th className="px-3 py-2 font-semibold">Hospital</th>
                <th className="px-3 py-2 font-semibold">Lista</th>
                <th className="px-3 py-2 font-semibold">Coincidencia</th>
                <th className="px-3 py-2 font-semibold">¿Informado?</th>
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
                        {listaTieneFoto(p) && listaId(p) != null && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVerImagen({ listaId: listaId(p), fuenteUrl: listaFuenteUrl(p) });
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
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <InformadoControl p={p} esAdmin={esAdmin} onSet={setInformado} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {detalle && <PersonaDetalle persona={detalle} onClose={() => setDetalle(null)} />}
      {verImagen && (
        <ListaImagenModal
          listaId={verImagen.listaId}
          fuenteUrl={verImagen.fuenteUrl}
          onClose={() => setVerImagen(null)}
        />
      )}
    </section>
  );
}
