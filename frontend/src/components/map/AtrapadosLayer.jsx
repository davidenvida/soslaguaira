// Capa de ATRAPADOS — rescate urgente. Los de estado 'atrapado' se destacan
// (pin grande, rojo, con pulso) para que salten a la vista del rescatista.
// Clustering por proximidad: varios en el mismo punto -> un cluster con modal.
import { useMemo, useState } from 'react';
import { LayerGroup, Marker, Popup } from 'react-leaflet';
import { atrapadoEstado } from './mapColors';
import { atrapadoIcon, clusterIcon } from './markerIcons';
import { agruparPorProximidad } from './clustering';
import ClusterModal from './ClusterModal';
import PopupFoto from './PopupFoto';
import { resolveFoto, contactoNombre, cantidadPersonas, hasLatLng } from './fields';

const ATRAPADO_CLUSTER_COLOR = '#dc2626';
const wazeUrl = (lat, lng) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
const gmapsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
const tituloAtrapado = (a) => {
  const cant = cantidadPersonas(a);
  return cant ? `${cant} persona${cant > 1 ? 's' : ''} atrapada${cant > 1 ? 's' : ''}` : 'Personas atrapadas';
};

const toItem = (a) => {
  const est = atrapadoEstado(a.estado);
  return {
    id: a.id,
    fotoSrc: resolveFoto(a),
    titulo: tituloAtrapado(a),
    subtitulo: [a.edificio, a.direccion].filter(Boolean).join(', '),
    badgeLabel: est.label,
    badgeColor: est.color,
  };
};

function MarcadorAtrapado({ a }) {
  const est = atrapadoEstado(a.estado);
  const foto = resolveFoto(a);
  const cant = cantidadPersonas(a);
  const contacto = contactoNombre(a);
  return (
    <Marker
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
            <div className="sos-popup__title">{tituloAtrapado(a)}</div>
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
}

export default function AtrapadosLayer({ atrapados = [], estadoFiltro = 'todos' }) {
  const [modal, setModal] = useState(null);

  const grupos = useMemo(() => {
    const visibles = atrapados
      .filter(hasLatLng)
      .filter((a) => estadoFiltro === 'todos' || a.estado === estadoFiltro);
    return agruparPorProximidad(visibles, (a) => a.lat, (a) => a.lng, 4);
  }, [atrapados, estadoFiltro]);

  return (
    <>
      <LayerGroup>
        {grupos.map((g) =>
          g.items.length === 1 ? (
            <MarcadorAtrapado key={g.items[0].id} a={g.items[0]} />
          ) : (
            <Marker
              key={g.key}
              position={[g.lat, g.lng]}
              icon={clusterIcon(g.items.length, ATRAPADO_CLUSTER_COLOR)}
              zIndexOffset={1000}
              eventHandlers={{
                click: () => setModal({ titulo: `${g.items.length} reportes en este lugar`, items: g.items.map(toItem) }),
              }}
            />
          ),
        )}
      </LayerGroup>
      {modal && <ClusterModal titulo={modal.titulo} items={modal.items} onClose={() => setModal(null)} />}
    </>
  );
}
