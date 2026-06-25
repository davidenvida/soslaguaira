// Ficha de detalle genérica para reportes del mapa (atrapados / edificios).
// PersonaDetalle es específico de desaparecidos (marcar a salvo); esto es para
// reportes simples: foto + badge de estado + filas de info. Modal portal,
// accesible y viewport-safe. La foto se amplía en el Lightbox.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Lightbox from '../ui/Lightbox';

const GLYPHS = {
  persona: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5.33 0-8 2.67-8 6v2h16v-2c0-3.33-2.67-6-8-6Z',
  edificio: 'M4 21V3h10v6h6v12h-7v-5h-2v5H4Zm3-4h2v-2H7v2Zm0-4h2v-2H7v2Zm0-4h2V7H7v2Zm4 4h2v-2h-2v2Zm0-4h2V7h-2v2Z',
};

export default function DetalleReporte({ titulo, fotoSrc, fotoVariant = 'persona', badge, filas = [], onClose }) {
  const closeRef = useRef(null);
  const prevFocus = useRef(null);
  const [imgError, setImgError] = useState(false);
  const [zoom, setZoom] = useState(false);

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

  const hayFoto = fotoSrc && !imgError;
  const visibles = filas.filter((f) => f && f.value);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="truncate text-sm font-bold text-slate-900">{titulo}</h2>
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          {hayFoto ? (
            <img
              src={fotoSrc}
              alt={titulo}
              loading="lazy"
              onError={() => setImgError(true)}
              onClick={() => setZoom(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setZoom(true);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Ampliar foto de ${titulo}`}
              className="aspect-[4/5] max-h-72 w-full cursor-zoom-in bg-slate-100 object-cover object-top focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
            />
          ) : (
            <div className="flex aspect-[4/5] max-h-72 w-full items-center justify-center bg-slate-100 text-slate-300">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d={GLYPHS[fotoVariant] || GLYPHS.persona} />
              </svg>
            </div>
          )}

          <div className="space-y-1.5 p-4">
            {badge?.label && (
              <span
                className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                style={{ background: badge.color || '#9ca3af' }}
              >
                {badge.label}
              </span>
            )}
            {visibles.map((f, i) => (
              <p key={i} className="text-sm text-slate-700">
                <span className="font-semibold text-slate-500">{f.label}: </span>
                {f.value}
              </p>
            ))}
          </div>
        </div>
      </div>

      {zoom && hayFoto && (
        <Lightbox src={fotoSrc} alt={titulo} caption={titulo} onClose={() => setZoom(false)} />
      )}
    </div>,
    document.body,
  );
}
