// Iconos custom de Leaflet via L.divIcon (SVG inline, sin imagenes).
// Ventaja: control total de color por estado, livianos (conectividad mala),
// sin el clasico bug de marker roto con bundlers.
import L from 'leaflet';

// Pin tipo gota con un glifo central. `size` controla el alto en px.
const pinSvg = (color, glyph, size, ring) => {
  const w = size * 0.7;
  return `
    <svg width="${w}" height="${size}" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 26 14 26s14-16.5 14-26C28 6.27 21.73 0 14 0z"
            fill="${color}" stroke="${ring || '#ffffff'}" stroke-width="2"/>
      <circle cx="14" cy="14" r="8" fill="#ffffff" fill-opacity="0.92"/>
      <text x="14" y="18" font-size="11" font-weight="700" text-anchor="middle"
            fill="${color}" font-family="system-ui, sans-serif">${glyph}</text>
    </svg>`;
};

const buildIcon = (color, glyph, { size = 36, urgente = false } = {}) => {
  const wrapperClass = urgente ? 'sos-pin sos-pin--urgente' : 'sos-pin';
  return L.divIcon({
    html: `<div class="${wrapperClass}">${pinSvg(color, glyph, size)}</div>`,
    className: 'sos-divicon', // limpia el fondo blanco default de divIcon
    iconSize: [size * 0.7, size],
    iconAnchor: [size * 0.35, size], // punta de la gota
    popupAnchor: [0, -size + 4],
  });
};

// Glifos por categoria
export const personaIcon = (color) => buildIcon(color, 'P', { size: 34 });
export const atrapadoIcon = (color, urgente) =>
  buildIcon(color, '!', { size: urgente ? 44 : 38, urgente });
export const edificioIcon = (color) => buildIcon(color, 'E', { size: 38 });
// Desaparecidos (intel): marcador ROSA fijo, distinto de las otras capas.
// Si `destacado`, pin más grande con pulso (al navegar desde el directorio).
export const DESAPARECIDO_COLOR = '#ec4899';
export const desaparecidoIcon = (destacado = false) =>
  buildIcon(DESAPARECIDO_COLOR, 'D', { size: destacado ? 46 : 34, urgente: destacado });
