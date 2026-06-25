// "Ver listas subidas": botón + modal que lista las listas manuscritas
// digitalizadas. Dos modos:
//  - PÚBLICO (por defecto, sin token): GET /api/listas/publicas — solo
//    ingresados/trasladados/heridos, SIN cédula ni coincidencias (entradas:
//    {nombre, estado, lugar}). Fallecidos nunca aparecen.
//  - ADMIN (si hay ?token= en la URL): GET /api/listas con X-Admin-Token —
//    full (cédulas, todos los tipos, coincidencias).
// Standalone, mobile-first, viewport-safe.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import http, { fotoUrl as toBackendUrl } from '../../api';
import Lightbox from '../ui/Lightbox';
import TablaPersonas from './TablaPersonas';
import { normalizarFilas, ESTADO_LISTA } from './listasUtils';

const tokenDeUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get('token') || '';
  } catch {
    return '';
  }
};

const unwrap = (r) => r.data?.data ?? r.data;
const listar = (token) =>
  token
    ? http.get('/listas', { headers: { 'X-Admin-Token': token } }).then(unwrap)
    : http.get('/listas/publicas').then(unwrap);
const detalle = (id, token) =>
  token
    ? http.get(`/listas/${id}`, { headers: { 'X-Admin-Token': token } }).then(unwrap)
    : http.get(`/listas/publicas/${id}`).then(unwrap);

// Borrado de lista (solo admin): cascade de entradas + imagen.
const borrar = (id, token) =>
  http.delete(`/listas/${id}`, { headers: { 'X-Admin-Token': token } }).then(unwrap);

const fmtFecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const normalizarListas = (res) => {
  const arr = res?.listas || res?.items || (Array.isArray(res) ? res : res?.data) || [];
  return Array.isArray(arr) ? arr : [];
};

// Filtra filas/entradas por nombre en vivo (buscador dentro de una lista).
const filtrarPorNombre = (filas, q) => {
  const t = (q || '').trim().toLowerCase();
  if (!t) return filas;
  return (filas || []).filter((f) => (f.nombre || '').toLowerCase().includes(t));
};

// Tabla simple para el detalle público (con cédula; sin coincidencias).
function TablaPublica({ entradas }) {
  if (!entradas || entradas.length === 0) {
    return <p className="text-sm text-slate-500">No hay personas en esta lista.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {entradas.map((e, i) => (
        <li key={i} className="flex items-start gap-2 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <div className="truncate text-slate-800">{e.nombre || '—'}</div>
            <div className="flex flex-wrap gap-x-2 text-xs text-slate-400">
              {e.cedula && <span className="tabular-nums">C.I. {e.cedula}</span>}
              {e.lugar && <span>{e.lugar}</span>}
            </div>
          </div>
          {e.estado && (
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${ESTADO_LISTA[e.estado] || ESTADO_LISTA.desconocido}`}>
              {e.estado}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Modal({ children, onClose, label }) {
  const closeRef = useRef(null);
  const prevFocus = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        // Focus-trap: ciclar dentro del diálogo (mismo patrón que Lightbox/Cluster).
        const nodes = dialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (prevFocus.current?.focus) prevFocus.current.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="truncate text-sm font-bold text-slate-900">{label}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-slate-500 hover:bg-slate-100"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export default function VerListasSubidas({ className = '' }) {
  const token = tokenDeUrl();
  const esAdmin = !!token;
  const [abierto, setAbierto] = useState(false);
  const [listas, setListas] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [sel, setSel] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [filtroDetalle, setFiltroDetalle] = useState(''); // buscador dentro de una lista

  useEffect(() => {
    if (!abierto) return undefined;
    let vivo = true;
    setStatus('loading');
    listar(token)
      .then((res) => {
        if (vivo) {
          setListas(normalizarListas(res));
          setStatus('ready');
        }
      })
      .catch(() => vivo && setStatus('error'));
    return () => {
      vivo = false;
    };
  }, [abierto, token]);

  const abrirDetalle = async (l) => {
    setFiltroDetalle('');
    setCargandoDetalle(true);
    try {
      const res = await detalle(l.id, token);
      setSel({
        ...l,
        ...res,
        filas: esAdmin ? normalizarFilas(res) : [],
        entradas: res?.entradas || [],
      });
    } catch {
      setSel({ ...l, error: true });
    } finally {
      setCargandoDetalle(false);
    }
  };

  const borrarLista = async () => {
    if (!sel || borrando) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`¿Borrar la lista "${sel.fuente || ''}" y todas sus entradas? No se puede deshacer.`)) return;
    setBorrando(true);
    try {
      await borrar(sel.id, token);
      setListas((prev) => prev.filter((l) => l.id !== sel.id));
      setSel(null);
    } catch {
      setSel((s) => (s ? { ...s, errorBorrar: true } : s));
    } finally {
      setBorrando(false);
    }
  };

  const cerrar = () => {
    setAbierto(false);
    setSel(null);
    setZoom(false);
  };

  const foto = sel ? toBackendUrl(sel.foto_url || sel.fotoUrl || '') : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Ver listas subidas"
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 ${className}`}
      >
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h10v2H4z" />
        </svg>
        <span className="hidden sm:inline">Ver listas subidas</span>
      </button>

      {abierto && (
        <Modal onClose={cerrar} label={sel ? sel.fuente || 'Lista' : 'Listas subidas'}>
          {sel ? (
            <div>
              <button
                type="button"
                onClick={() => setSel(null)}
                className="mb-3 text-xs font-semibold text-indigo-600 hover:underline"
              >
                ← Volver a las listas
              </button>
              <div className="mb-3 flex items-start gap-3">
                {foto && (
                  <img
                    src={foto}
                    alt={`Foto original de ${sel.fuente || 'la lista'}`}
                    onClick={() => setZoom(true)}
                    className="h-20 w-16 shrink-0 cursor-zoom-in rounded-md object-cover ring-1 ring-slate-200"
                  />
                )}
                <div className="min-w-0 text-xs text-slate-500">
                  <div className="text-sm font-bold text-slate-800">{sel.fuente || 'Lista'}</div>
                  {sel.tipo && <div>Tipo: {sel.tipo}</div>}
                  {fmtFecha(sel.fecha || sel.created_at) && <div>{fmtFecha(sel.fecha || sel.created_at)}</div>}
                </div>
              </div>
              {cargandoDetalle ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : sel.error ? (
                <p className="text-sm text-red-600">No se pudo cargar el detalle.</p>
              ) : (
                <>
                  <label htmlFor="detalle-q" className="sr-only">Buscar en esta lista</label>
                  <input
                    id="detalle-q"
                    type="search"
                    value={filtroDetalle}
                    onChange={(e) => setFiltroDetalle(e.target.value)}
                    placeholder="Buscar un nombre en esta lista…"
                    className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                  {esAdmin ? (
                    <TablaPersonas filas={filtrarPorNombre(sel.filas, filtroDetalle)} />
                  ) : (
                    <TablaPublica entradas={filtrarPorNombre(sel.entradas, filtroDetalle)} />
                  )}
                </>
              )}

              {esAdmin && !cargandoDetalle && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={borrarLista}
                    disabled={borrando}
                    className="min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
                  >
                    {borrando ? 'Borrando…' : 'Borrar lista'}
                  </button>
                  {sel.errorBorrar && (
                    <span className="ml-2 text-xs text-red-600">No se pudo borrar.</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              {status === 'loading' && <p className="text-sm text-slate-500">Cargando…</p>}
              {status === 'error' && <p className="text-sm text-red-600">No se pudieron cargar las listas.</p>}
              {status === 'ready' && listas.length === 0 && (
                <p className="text-sm text-slate-500">Aún no hay listas subidas.</p>
              )}
              {status === 'ready' && listas.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {listas.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => abrirDetalle(l)}
                        className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-800">{l.fuente || 'Lista'}</div>
                          <div className="text-xs text-slate-500">
                            {[l.tipo, fmtFecha(l.fecha || l.created_at)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {l.total != null && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            <span className="tabular-nums">{l.total}</span> {l.total === 1 ? 'persona' : 'personas'}
                          </span>
                        )}
                        <span className="shrink-0 text-slate-300" aria-hidden="true">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Modal>
      )}

      {zoom && foto && <Lightbox src={foto} alt="Foto original de la lista" onClose={() => setZoom(false)} />}
    </>
  );
}
