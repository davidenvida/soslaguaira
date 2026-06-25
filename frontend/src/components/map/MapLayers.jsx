// Orquestador de capas. Va DENTRO de <MapBase> como children.
// Lee datos/visibilidad/filtros del MapDataProvider y monta cada capa.
// Edificios al fondo, personas en medio, atrapados (urgentes) arriba.
import './mapLayers.css';
import { useMapData } from './MapDataContext';
import EdificiosLayer from './EdificiosLayer';
import PersonasLayer from './PersonasLayer';
import AtrapadosLayer from './AtrapadosLayer';

export default function MapLayers() {
  const { data, visibility, filters } = useMapData();
  return (
    <>
      {visibility.edificios && (
        <EdificiosLayer edificios={data.edificios} estadoFiltro={filters.edificios} />
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
