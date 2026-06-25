// Punto de entrada de las capas del mapa. Bruno cablea desde aqui.
//
// Uso recomendado en App.jsx:
//
//   import { MapDataProvider, MapLayers, LayersPanel } from './components/map'
//   import MapBase from './components/MapBase'
//
//   <MapDataProvider>
//     <div className="relative h-full w-full">
//       <MapBase onPick={...}>
//         <MapLayers />
//       </MapBase>
//       <LayersPanel />
//     </div>
//   </MapDataProvider>
//
// MapLayers va DENTRO de MapBase (son capas Leaflet). LayersPanel va FUERA,
// como overlay hermano dentro de un contenedor 'relative'.

export { MapDataProvider, useMapData } from './MapDataContext';
export { default as MapLayers } from './MapLayers';
export { default as LayersPanel } from './LayersPanel';

// Capas individuales (por si se quieren usar sueltas con datos propios).
export { default as PersonasLayer } from './PersonasLayer';
export { default as AtrapadosLayer } from './AtrapadosLayer';
export { default as EdificiosLayer } from './EdificiosLayer';
