// Capa de ATRAPADOS — rescate urgente. Los de estado 'atrapado' se destacan
// (pin grande, rojo, con pulso) para que salten a la vista del rescatista.
import { LayerGroup, Marker, Popup } from 'react-leaflet';
import { atrapadoEstado } from './mapColors';
import { atrapadoIcon } from './markerIcons';
import PopupFoto from './PopupFoto';
import { resolveFoto, contactoNombre, cantidadPersonas, hasLatLng } from './fields';

const wazeUrl = (lat, lng) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
const gmapsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export default function AtrapadosLayer({ atrapados = [], estadoFiltro = 'todos' }) {
  const visibles = atrapados
    .filter(hasLatLng)
    .filter((a) => estadoFiltro === 'todos' || a.estado === estadoFiltro);

  return (
    <LayerGroup>
      {visibles.map((a) => {
        const est = atrapadoEstado(a.estado);
        const foto = resolveFoto(a);
        const cant = cantidadPersonas(a);
        const contacto = contactoNombre(a);
        return (
          <Marker
            key={a.id}
            position={[a.lat, a.lng]}
            icon={atrapadoIcon(est.color, est.urgente)}
            zIndexOffset={est.urgente ? 1000 : 200}
          >
            <Popup>
              <div className="sos-popup">
                <PopupFoto src={foto} alt="Personas atrapadas" />
                <div className="sos-popup__body">
                  <span className="sos-popup__badge" style={{ background: est.color }}>
                    {est.label}
                  </span>
                  <div className="sos-popup__title">
                    {cant ? `${cant} persona${cant > 1 ? 's' : ''} atrapada${cant > 1 ? 's' : ''}` : 'Personas atrapadas'}
                  </div>
                  {(a.edificio || a.direccion) && (
                    <div className="sos-popup__row">
                      <span className="sos-popup__label">Ubicación: </span>
                      {[a.edificio, a.piso && `piso ${a.piso}`, a.direccion].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {a.descripcion && <div className="sos-popup__row">{a.descripcion}</div>}
                  {contacto && (
                    <div className="sos-popup__row">
                      <span className="sos-popup__label">Contacto: </span>
                      {contacto}
                    </div>
                  )}
                  {est.urgente && <div className="sos-popup__urgente">⚠ Rescate urgente</div>}
                  <div className="sos-popup__row" style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <a href={wazeUrl(a.lat, a.lng)} target="_blank" rel="noreferrer">Waze</a>
                    <a href={gmapsUrl(a.lat, a.lng)} target="_blank" rel="noreferrer">Google Maps</a>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </LayerGroup>
  );
}
