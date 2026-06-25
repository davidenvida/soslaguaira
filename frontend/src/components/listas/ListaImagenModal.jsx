// Ver imagen de una lista CON GATE: pide nombre + teléfono (obligatorios) ->
// POST /api/listas/:id/acceso -> devuelve foto_url -> muestra la imagen con ZOOM
// (botones +/-, scroll y pinch) y pan, + 'Descargar lista' y 'Ver publicación'
// (si la lista trae fuente_url). El nombre+teléfono queda registrado como que un
// familiar accedió. Mobile-first, viewport-safe.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import http, { fotoUrl as toBackendUrl } from '../../api';

const pedirAcceso = (id, payload) =>
  http.post(`/listas/${id}/acceso`, payload).then((r) => r.data?.data ?? r.data);

const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

export default function ListaImagenModal({ listaId, fuenteUrl, onClose }) {
  const [fase, setFase] = useState('form'); // form | enviando | imagen | error
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [foto, setFoto] = useState('');
  const closeRef = useRef(null);
  const prevFocus = useRef(null);
  // onClose vía ref: efecto de montaje una sola vez (si dependiera de [onClose]
  // recreado por el padre, cada keystroke reenfocaría y el input perdería el foco).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Zoom / pan
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const pinch = useRef(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (prevFocus.current?.focus) prevFocus.current.focus();
    };
  }, []);

  const enviar = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !telefono.trim() || fase === 'enviando') return;
    setFase('enviando');
    try {
      const res = await pedirAcceso(listaId, { nombre: nombre.trim(), telefono: telefono.trim() });
      setFoto(toBackendUrl(res?.foto_url || res?.fotoUrl || ''));
      setFase('imagen');
    } catch {
      setFase('error');
    }
  };

  const ajustarZoom = (delta) => setScale((s) => Math.min(5, Math.max(1, +(s + delta).toFixed(2))));
  const resetZoom = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  const onWheel = (e) => {
    e.preventDefault();
    ajustarZoom(e.deltaY < 0 ? 0.2 : -0.2);
  };
  const onPointerDown = (e) => {
    drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  const onPointerMove = (e) => {
    if (!drag.current || scale === 1) return;
    setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onTouchStart = (e) => {
    if (e.touches.length === 2) pinch.current = { d: dist(e.touches), s: scale };
    else if (e.touches.length === 1) drag.current = { x: e.touches[0].clientX - pos.x, y: e.touches[0].clientY - pos.y };
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinch.current) {
      const ratio = dist(e.touches) / pinch.current.d;
      setScale(Math.min(5, Math.max(1, +(pinch.current.s * ratio).toFixed(2))));
    } else if (e.touches.length === 1 && drag.current && scale > 1) {
      setPos({ x: e.touches[0].clientX - drag.current.x, y: e.touches[0].clientY - drag.current.y });
    }
  };
  const onTouchEnd = () => {
    pinch.current = null;
    drag.current = null;
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Imagen de la lista"
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">Imagen de la lista</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-slate-500 hover:bg-slate-100"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {fase === 'imagen' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className="relative min-h-0 flex-1 touch-none overflow-hidden bg-slate-900"
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <img
                src={foto}
                alt="Lista original"
                draggable={false}
                className="mx-auto block max-h-[55dvh] w-full select-none object-contain"
                style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale > 1 ? 'grab' : 'default', transition: drag.current ? 'none' : 'transform 0.1s' }}
              />
              <div className="absolute bottom-2 right-2 flex gap-1">
                <button type="button" onClick={() => ajustarZoom(0.4)} aria-label="Acercar" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-slate-700 shadow">+</button>
                <button type="button" onClick={() => ajustarZoom(-0.4)} aria-label="Alejar" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-slate-700 shadow">−</button>
                <button type="button" onClick={resetZoom} aria-label="Restablecer zoom" className="flex h-9 items-center justify-center rounded-full bg-white/90 px-3 text-xs font-semibold text-slate-700 shadow">1:1</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
              <a
                href={foto}
                download
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Descargar lista
              </a>
              {fuenteUrl && (
                <a
                  href={fuenteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  Ver publicación
                </a>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-3 p-4">
            <p className="text-xs text-slate-500">Para ver la lista, ingresa tus datos. Quedan registrados como que un familiar accedió.</p>
            <div>
              <label htmlFor="acc-nombre" className="mb-1 block text-sm font-semibold text-slate-700">Tu nombre</label>
              <input
                id="acc-nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre y apellido"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="acc-tel" className="mb-1 block text-sm font-semibold text-slate-700">Tu teléfono</label>
              <input
                id="acc-tel"
                type="tel"
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: +58 412 1234567"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {fase === 'error' && (
              <p className="text-xs text-red-600" role="alert">No se pudo abrir la imagen. Intenta de nuevo.</p>
            )}
            <button
              type="submit"
              disabled={!nombre.trim() || !telefono.trim() || fase === 'enviando'}
              className="min-h-[44px] w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {fase === 'enviando' ? 'Abriendo…' : 'Ver imagen de la lista'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
