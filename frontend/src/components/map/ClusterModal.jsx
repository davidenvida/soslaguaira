// Modal con la lista de reportes de un punto agrupado (cluster). Se abre al
// hacer clic en un marcador-cluster. Cada item: foto chica + nombre + estado +
// enlace. Accesible (dialog modal, Escape, backdrop, scroll lock) y respeta el
// viewport (lista scrollable con tope de alto).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FuenteIcono from '../ui/FuenteIcono';

function FotoChica({ src, alt }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-300" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5.33 0-8 2.67-8 6v2h16v-2c0-3.33-2.67-6-8-6Z" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setError(true)}
      className="h-12 w-12 shrink-0 rounded-md object-cover object-top"
    />
  );
}

export default function ClusterModal({ titulo, items = [], onClose }) {
  const closeRef = useRef(null);
  const prevFocus = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        // Focus-trap: ciclar dentro del diálogo (mismo patrón que Lightbox/App).
        const nodes = dialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
      document.body.style.overflow = prevOverflow;
      if (prevFocus.current && prevFocus.current.focus) prevFocus.current.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">{titulo}</h2>
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

        <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 px-4 py-3">
              <FotoChica src={it.fotoSrc} alt={it.titulo} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">{it.titulo}</span>
                  {it.badgeLabel && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: it.badgeColor || '#9ca3af' }}
                    >
                      {it.badgeLabel}
                    </span>
                  )}
                </div>
                {it.subtitulo && <p className="truncate text-xs text-slate-500">{it.subtitulo}</p>}
                {it.fuenteUrl && (
                  <a
                    href={it.fuenteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                  >
                    <FuenteIcono url={it.fuenteUrl} />
                    Ver publicación
                    <span className="sr-only"> (abre en nueva pestaña)</span>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
