// Lightbox de foto a pantalla completa, compartido (popups del mapa + galería).
// Controlado: el padre lo renderiza solo cuando hay foto que ampliar y pasa
// onClose. Cierra con backdrop, botón X o Escape. Accesible (dialog modal,
// focus-trap, retorno de foco) y respeta el viewport. Spec acordado con Fiona.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'button, a[href], [tabindex]:not([tabindex="-1"])';

export default function Lightbox({ src, alt = 'Foto', caption, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const prevFocus = useRef(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();

    // Bloquear scroll del fondo mientras está abierto.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        // Focus-trap: ciclar dentro del diálogo.
        const nodes = dialogRef.current?.querySelectorAll(FOCUSABLE);
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
      // Devolver el foco a la miniatura que abrió el lightbox.
      if (prevFocus.current && prevFocus.current.focus) prevFocus.current.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-black/80 p-4"
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl leading-none text-white hover:bg-white/25"
        style={{ marginTop: 'env(safe-area-inset-top)', marginRight: 'env(safe-area-inset-right)' }}
      >
        <span aria-hidden="true">×</span>
      </button>

      {/* La imagen no debe cerrar al hacer clic sobre ella. */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-7rem)] max-w-[calc(100vw-2rem)] rounded-lg object-contain shadow-2xl"
      />

      {caption && (
        <p
          onClick={(e) => e.stopPropagation()}
          className="mt-3 max-w-[calc(100vw-2rem)] text-center text-sm text-white/90"
          style={{ overflowWrap: 'anywhere' }}
        >
          {caption}
        </p>
      )}
    </div>,
    document.body,
  );
}
