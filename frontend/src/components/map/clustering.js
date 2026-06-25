// Agrupa marcadores por proximidad redondeando lat/lng a `precision` decimales
// (4 ≈ 11 m: mismo edificio/punto). Devuelve [{ key, lat, lng, items }] usando
// la posición del primer item del grupo como ancla del cluster.
export function agruparPorProximidad(items, getLat, getLng, precision = 4) {
  const f = 10 ** precision;
  const grupos = new Map();
  for (const it of items) {
    const la = getLat(it);
    const ln = getLng(it);
    const key = `${Math.round(la * f) / f},${Math.round(ln * f) / f}`;
    let g = grupos.get(key);
    if (!g) {
      g = { key, lat: la, lng: ln, items: [] };
      grupos.set(key, g);
    }
    g.items.push(it);
  }
  return [...grupos.values()];
}
