// "Ver listas subidas": botón + modal que lista todas las listas manuscritas
// digitalizadas (fuente, tipo, fecha, total). Al clic en una, muestra su versión
// digital (tabla nombre/cédula/estado/coincidencia) + thumbnail de la foto
// original (clic para ampliar). Standalone, mobile-first, viewport-safe.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import http, { fotoUrl as toBackendUrl } from '../../api';
import Lightbox from '../ui/Lightbox';
import TablaPersonas from './TablaPersonas';
import { normalizarFilas } from './listasUtils';

// Ambos endpoints son ADMIN: requieren header X-Admin-Token.
const tokenDeUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get('token') || '';
  } catch {
    return '';
  }
};

const listar = (token) =>
  http.get('/listas', { headers: { 'X-Admin-Token': token } }).then((r) => r.data?.data ?? r.data);

const detalle = (id, token) =>
  http.get(`/listas/${id}`, { headers: { 'X-Admin-Token': token } }).then((r) => r.data?.data ?? r.data);

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

function Modal({ children, onClose, label }) {
  const closeRef = useRef(null);
  const prevFocus = useRef(null);
  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (prevFocus.current?.focus) prevFocus.current.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
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
  const [abierto, setAbierto] = useState(false);
  const [token, setToken] = useState(tokenDeUrl);
  const [input, setInput] = useState('');
  const [listas, setListas] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error | denied
  const [sel, setSel] = useState(null); // detalle de la lista seleccionada
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!abierto || !token) return undefined;
    let vivo = true;
    setStatus('loading');
    listar(token)
      .then((res) => {
        if (vivo) {
          setListas(normalizarListas(res));
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (!vivo) return;
        const code = err?.response?.status;
        setStatus(code === 401 || code === 403 ? 'denied' : 'error');
      });
    return () => {
      vivo = false;
    };
  }, [abierto, token]);

  const abrirDetalle = async (l) => {
    setCargandoDetalle(true);
    try {
      const res = await detalle(l.id, token);
      setSel({ ...l, ...res, filas: normalizarFilas(res) });
    } catch {
      setSel({ ...l, filas: [], error: true });
    } finally {
      setCargandoDetalle(false);
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
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 ${className}`}
      >
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h10v2H4z" />
        </svg>
        Ver listas subidas
      </button>

      {abierto && (
        <Modal onClose={cerrar} label={sel ? sel.fuente || 'Lista' : 'Listas subidas'}>
          {!token || status === 'denied' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) {
                  setStatus('idle');
                  setToken(input.trim());
                }
              }}
              className="space-y-2"
            >
              <p className="text-xs text-slate-500">
                {status === 'denied' ? 'Token inválido. Inténtalo de nuevo.' : 'Estas listas contienen datos sensibles. Ingresa el token de administrador.'}
              </p>
              <label htmlFor="listas-token" className="sr-only">Token de administrador</label>
              <input
                id="listas-token"
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Token de administrador"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
              <button
                type="submit"
                className="min-h-[44px] w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Ver listas
              </button>
            </form>
          ) : sel ? (
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
                <TablaPersonas filas={sel.filas} />
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
                        {(l.total != null || l.personas) && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
                            {l.total ?? l.personas?.length ?? 0}
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
