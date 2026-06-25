// Foto de un popup del mapa: imagen contenida con lazy-load, o placeholder si
// no hay foto o si falla la carga (red de seguridad ante CSP / 404).
// Al hacer clic (o Enter/Espacio) amplía la foto en el Lightbox compartido.
import { useState } from 'react';
import Lightbox from '../ui/Lightbox';

const GLYPHS = {
  persona: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5.33 0-8 2.67-8 6v2h16v-2c0-3.33-2.67-6-8-6Z',
  edificio: 'M4 21V3h10v6h6v12h-7v-5h-2v5H4Zm3-4h2v-2H7v2Zm0-4h2v-2H7v2Zm0-4h2V7H7v2Zm4 4h2v-2h-2v2Zm0-4h2V7h-2v2Z',
};

function Placeholder({ variant }) {
  return (
    <div
      className="sos-popup__img"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}
      aria-hidden="true"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
        <path d={GLYPHS[variant] || GLYPHS.persona} />
      </svg>
    </div>
  );
}

export default function PopupFoto({ src, alt = 'Foto', variant = 'persona', caption }) {
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(false);

  if (!src || error) return <Placeholder variant={variant} />;

  return (
    <>
      <img
        className="sos-popup__img"
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setError(true)}
        onClick={() => setZoom(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setZoom(true);
          }
        }}
        role="button"
        tabIndex={0}
        title="Ampliar foto"
        style={{ cursor: 'zoom-in' }}
      />
      {zoom && <Lightbox src={src} alt={alt} caption={caption || alt} onClose={() => setZoom(false)} />}
    </>
  );
}
