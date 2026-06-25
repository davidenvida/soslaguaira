// Botón "Reportar error" + modal simple. La gente describe dónde está el error
// (texto obligatorio) y un contacto opcional -> POST /api/errores. Standalone:
// Bruno lo monta en el header junto a Rescatistas. Mobile-first, viewport-safe.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import http from '../../api';

const enviarError = (payload) => http.post('/errores', payload).then((r) => r.data);

export default function ReportarError({ className = '' }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [contacto, setContacto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState(false);
  const closeRef = useRef(null);
  const prevFocus = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (prevFocus.current?.focus) prevFocus.current.focus();
    };
  }, [abierto]);

  const cerrar = () => {
    setAbierto(false);
    setExito(false);
    setError(false);
    setTexto('');
    setContacto('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (enviando || !texto.trim()) return;
    setEnviando(true);
    setError(false);
    try {
      await enviarError({ texto: texto.trim(), contacto: contacto.trim() });
      setExito(true);
    } catch {
      setError(true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`min-h-[40px] shrink-0 rounded bg-white/15 px-3 py-1 text-xs font-semibold text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${className}`}
      >
        Reportar error
      </button>

      {abierto &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reportar un error"
            className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
            onClick={cerrar}
          >
            <div
              className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">Reportar un error</h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={cerrar}
                  aria-label="Cerrar"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-slate-500 hover:bg-slate-100"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {exito ? (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700" role="status">
                    Gracias por reportar el error.
                  </p>
                ) : (
                  <form onSubmit={onSubmit} className="space-y-3">
                    <div>
                      <label htmlFor="err-texto" className="mb-1 block text-sm font-semibold text-slate-700">
                        ¿Dónde está el error?
                      </label>
                      <textarea
                        id="err-texto"
                        rows={4}
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        placeholder="Describe qué viste mal y en qué parte del sitio…"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                      />
                    </div>
                    <div>
                      <label htmlFor="err-contacto" className="sr-only">Contacto (opcional)</label>
                      <input
                        id="err-contacto"
                        type="text"
                        value={contacto}
                        onChange={(e) => setContacto(e.target.value)}
                        placeholder="Contacto (opcional): correo o teléfono"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={enviando || !texto.trim()}
                      className="min-h-[44px] w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {enviando ? 'Enviando…' : 'Enviar'}
                    </button>
                    {error && (
                      <p className="text-center text-xs text-red-600" role="alert">
                        No se pudo enviar. Intenta de nuevo.
                      </p>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
