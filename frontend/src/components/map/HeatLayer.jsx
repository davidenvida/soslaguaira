// Capa de mapa de calor (densidad de reportes de emergencia). Usa leaflet.heat.
// points: [[lat, lng, intensidad], ...]. Va DENTRO de <MapBase> como child.
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

export default function HeatLayer({ points = [] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return undefined;
    const layer = L.heatLayer(points, {
      radius: 28,
      blur: 20,
      maxZoom: 17,
      minOpacity: 0.35,
      gradient: { 0.3: '#2563eb', 0.55: '#22c55e', 0.7: '#eab308', 0.85: '#f97316', 1: '#dc2626' },
    });
    layer.addTo(map);
    // Recalcula al cambiar el tamaño del contenedor (split/toggle).
    map.invalidateSize();
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);
  return null;
}
