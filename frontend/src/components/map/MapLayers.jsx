// Orquestador de capas. Va DENTRO de <MapBase> como children.
// Lee datos/visibilidad/filtros del MapDataProvider y monta cada capa.
// Edificios al fondo, personas en medio, atrapados (urgentes) arriba.
import './mapLayers.css';
import { useMapData } from './MapDataContext';
import EdificiosLayer from './EdificiosLayer';
import PersonasLayer from './PersonasLayer';
import AtrapadosLayer from './AtrapadosLayer';
import DesaparecidosLayer from './DesaparecidosLayer';

export default function MapLayers() {
  const { data, visibility, filters, destacarId, refresh } = useMapData();
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
