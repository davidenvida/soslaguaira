// Capa de personas (busco / reporto a salvo). Marcador coloreado por estado,
// popup con foto e info. Componente hijo de <MapContainer> (lo cablea Bruno).
import { LayerGroup, Marker, Popup } from 'react-leaflet';
import { personaEstado } from './mapColors';
import { personaIcon } from './markerIcons';
import PopupFoto from './PopupFoto';
import { resolveFoto, contactoNombre, contactoTelefono, hasLatLng } from './fields';

export default function PersonasLayer({ personas = [], estadoFiltro = 'todos' }) {
  const visibles = personas
    .filter(hasLatLng)
    .filter((p) => estadoFiltro === 'todos' || p.estado === estadoFiltro);

  return (
    <LayerGroup>
      {visibles.map((p) => {
        const est = personaEstado(p.estado);
        const foto = resolveFoto(p);
        const tel = contactoTelefono(p);
        return (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={personaIcon(est.color)}>
            <Popup>
              <div className="sos-popup">
                <PopupFoto src={foto} alt={`Foto de ${p.nombre || 'persona'}`} />
                <div className="sos-popup__body">
                  <span className="sos-popup__badge" style={{ background: est.color }}>
                    {est.label}
                  </span>
                  <div className="sos-popup__title">
                    {p.nombre || 'Sin nombre'}
                    {p.edad ? `, ${p.edad}` : ''}
                  </div>
                  {p.tipo && (
                    <div className="sos-popup__row">
                      <span className="sos-popup__label">Reporte: </span>
                      {p.tipo === 'busco' ? 'Lo están buscando' : 'Reportado a salvo'}
                    </div>
                  )}
                  {p.descripcion && <div className="sos-popup__row">{p.descripcion}</div>}
                  {(p.direccion || p.edificio) && (
                    <div className="sos-popup__row">
                      <span className="sos-popup__label">Ubicación: </span>
                      {[p.direccion, p.edificio, p.piso && `piso ${p.piso}`].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {(contactoNombre(p) || tel) && (
                    <div className="sos-popup__row">
                      <span className="sos-popup__label">Contacto: </span>
                      {contactoNombre(p) || ''}
                      {tel && (
                        <>
                          {' '}
                          <a href={`tel:${tel}`}>{tel}</a>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </LayerGroup>
  );
}
