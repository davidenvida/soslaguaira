import { normalizeName } from './validate.js';

// Construye un geocodificador a partir del gazetteer de residencias (375 con lat/lon).
// geocode(persona) -> { lat, lng, geo_fuente: 'edificio'|'parroquia'|null }
// 1) matchea sector_o_edificio (o ultima_ubicacion) contra residencias.nombre -> coords del edificio
// 2) fallback al CENTROIDE de la parroquia (promedio de sus residencias)
// 3) si nada matchea -> lat/lng null (queda solo en galeria, no en el mapa)
export function buildGeocoder(residencias) {
  const withCoords = residencias.filter((r) => r.lat != null && r.lon != null);

  // Nombres normalizados, los mas largos primero para preferir el match mas especifico.
  const named = withCoords
    .map((r) => ({ lat: Number(r.lat), lon: Number(r.lon), norm: normalizeName(r.nombre) }))
    .filter((r) => r.norm.length >= 4)
    .sort((a, b) => b.norm.length - a.norm.length);

  // Centroide por parroquia normalizada.
  const byParroquia = new Map();
  for (const r of withCoords) {
    const k = normalizeName(r.parroquia);
    if (!k) continue;
    if (!byParroquia.has(k)) byParroquia.set(k, []);
    byParroquia.get(k).push(r);
  }
  const centroids = new Map();
  for (const [k, list] of byParroquia) {
    const lat = list.reduce((s, r) => s + Number(r.lat), 0) / list.length;
    const lon = list.reduce((s, r) => s + Number(r.lon), 0) / list.length;
    centroids.set(k, { lat, lon });
  }

  return function geocode(person) {
    const target = normalizeName(person.sector_o_edificio || person.ultima_ubicacion || '');
    if (target) {
      for (const r of named) {
        if (target.includes(r.norm)) {
          return { lat: r.lat, lng: r.lon, geo_fuente: 'edificio' };
        }
      }
    }
    const pk = normalizeName(person.parroquia);
    if (pk && centroids.has(pk)) {
      const c = centroids.get(pk);
      return { lat: c.lat, lng: c.lon, geo_fuente: 'parroquia' };
    }
    return { lat: null, lng: null, geo_fuente: null };
  };
}
