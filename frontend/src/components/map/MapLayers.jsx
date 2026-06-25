// Orquestador de capas. Va DENTRO de <MapBase> como children.
// Lee datos/visibilidad/filtros del MapDataProvider y monta cada capa.
// Edificios al fondo, personas en medio, atrapados (urgentes) arriba.
// Con `heatmap` activo, alterna a un mapa de calor de densidad de reportes
// de emergencia (desaparecidos + atrapados) en vez de los marcadores.
import { useMemo } from 'react';
import './mapLayers.css';
import { useMapData } from './MapDataContext';
import EdificiosLayer from './EdificiosLayer';
import PersonasLayer from './PersonasLayer';
import AtrapadosLayer from './AtrapadosLayer';
import DesaparecidosLayer from './DesaparecidosLayer';
import HeatLayer from './HeatLayer';
import { hasLatLng } from './fields';

export default function MapLayers() {
  const { data, visibility, filters, destacarId, refresh, heatmap } = useMapData();

  // Puntos de calor: emergencias geolocalizadas (desaparecidos + atrapados).
  // Atrapados pesan más (rescate urgente).
  const heatPoints = useMemo(() => {
    const pts = [];
    for (const d of data.desaparecidos) if (hasLatLng(d)) pts.push([d.lat, d.lng, 0.8]);
    for (const a of data.atrapados) if (hasLatLng(a)) pts.push([a.lat, a.lng, 1.3]);
    return pts;
  }, [data.desaparecidos, data.atrapados]);

  if (heatmap) {
    return <HeatLayer points={heatPoints} />;
  }

  return (
    <>
      {visibility.edificios && (
        <EdificiosLayer edificios={data.edificios} estadoFiltro={filters.edificios} />
      )}
      {visibility.desaparecidos && (
        <DesaparecidosLayer
          desaparecidos={data.desaparecidos}
          estadoFiltro={filters.desaparecidos}
          destacarId={destacarId}
          onPersonaUpdate={refresh}
        />
      )}
      {visibility.personas && (
        <PersonasLayer personas={data.personas} estadoFiltro={filters.personas} />
      )}
      {visibility.atrapados && (
        <AtrapadosLayer atrapados={data.atrapados} estadoFiltro={filters.atrapados} />
      )}
    </>
  );
}
