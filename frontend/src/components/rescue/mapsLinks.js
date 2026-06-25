// Generadores de enlaces de navegación para rescatistas.
// Abren la app nativa (o web) directamente en modo "navegar hacia" el punto.

export function wazeUrl(lat, lng) {
  // navigate=yes lanza la navegación de inmediato.
  return `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`;
}

export function googleMapsUrl(lat, lng) {
  // dir_action=navigate inicia la guía paso a paso al destino.
  return `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}&travelmode=driving&dir_action=navigate`;
}

// Coordenadas legibles para mostrar/copiar.
export function formatCoords(lat, lng) {
  if (lat == null || lng == null) return '—';
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}
