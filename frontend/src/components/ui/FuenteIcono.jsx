// Icono de la fuente de un reporte, para anteponer al enlace "Ver publicación".
// Si la fuente es X (x.com / twitter.com) muestra el logo de X; si es otra
// (reportaven, etc.) muestra un icono genérico de enlace externo. Hereda color
// (currentColor) del enlace que lo contiene.

export const esFuenteX = (url) => {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return h === 'x.com' || h === 'twitter.com' || h.endsWith('.twitter.com') || h.endsWith('.x.com');
  } catch {
    return false;
  }
};

export default function FuenteIcono({ url, size = 14 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true, className: 'shrink-0' };
  if (esFuenteX(url)) {
    return (
      <svg {...common}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  // Enlace externo genérico.
  return (
    <svg {...common}>
      <path d="M5 5h6v2H7v10h10v-4h2v6H5zM14 3h7v7h-2V6.41l-8.29 8.3-1.42-1.42L17.59 5H14z" />
    </svg>
  );
}
