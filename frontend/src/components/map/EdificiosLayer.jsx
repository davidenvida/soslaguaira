// Capa de edificios. Marcador coloreado por estado estructural + circulo de
// area que refuerza el color (mejor lectura a zoom bajo). Popup con info.
import { LayerGroup, Marker, Circle, Popup } from 'react-leaflet';
import { edificioEstado } from './mapColors';
import { edificioIcon } from './markerIcons';
import { resolveFoto, atrapadosEstimados, hasLatLng } from './fields';

export default function EdificiosLayer({ edificios = [], estadoFiltro = 'todos' }) {
  const visibles = edificios
    .filter(hasLatLng)
    .filter((e) => estadoFiltro === 'todos' || e.estado === estadoFiltro);

  return (
    <LayerGroup>
      {visibles.map((e) => {
        const est = edificioEstado(e.estado);
        const foto = resolveFoto(e);
        const estimados = atrapadosEstimados(e);
        return (
          <LayerGroup key={e.id}>
            <Circle
              center={[e.lat, e.lng]}
              radius={28}
              pathOptions={{ color: est.color, fillColor: est.color, fillOpacity: 0.25, weight: 1 }}
            />
            <Marker position={[e.lat, e.lng]} icon={edificioIcon(est.color)}>
              <Popup>
                <div className="sos-popup">
                  {foto && <img className="sos-popup__img" src={foto} alt={e.nombre || 'Edificio'} />}
                  <div className="sos-popup__body">
                    <span className="sos-popup__badge" style={{ background: est.color }}>
                      {est.label}
                    </span>
                    <div className="sos-popup__title">{e.nombre || 'Edificio'}</div>
                    {e.direccion && (
                      <div className="sos-popup__row">
                        <span className="sos-popup__label">Dirección: </span>
                        {e.direccion}
                      </div>
                    )}
                    {estimados != null && (
                      <div className="sos-popup__row">
                        <span className="sos-popup__label">Atrapados estimados: </span>
                        {estimados}
                      </div>
                    )}
                    {e.descripcion && <div className="sos-popup__row">{e.descripcion}</div>}
                  </div>
                </div>
              </Popup>
            </Marker>
          </LayerGroup>
        );
      })}
    </LayerGroup>
  );
}
