// Capa de edificios. Marcador coloreado por estado estructural + circulo de
// area que refuerza el color (mejor lectura a zoom bajo). Popup con info.
// Clustering por proximidad: varios edificios en el mismo punto -> cluster+modal.
import { useMemo, useState } from 'react';
import { LayerGroup, Marker, Circle, Popup } from 'react-leaflet';
import { edificioEstado } from './mapColors';
import { edificioIcon, clusterIcon } from './markerIcons';
import { agruparPorProximidad } from './clustering';
import ClusterModal from './ClusterModal';
import PopupFoto from './PopupFoto';
import { resolveFoto, atrapadosEstimados, hasLatLng } from './fields';

const EDIFICIO_CLUSTER_COLOR = '#ea580c';

const toItem = (e) => {
  const est = edificioEstado(e.estado);
  return {
    id: e.id,
    fotoSrc: resolveFoto(e),
    titulo: e.nombre || 'Edificio',
    subtitulo: e.direccion || '',
    badgeLabel: est.label,
    badgeColor: est.color,
  };
};

function MarcadorEdificio({ e }) {
  const est = edificioEstado(e.estado);
  const foto = resolveFoto(e);
  const estimados = atrapadosEstimados(e);
  return (
    <LayerGroup>
      <Circle
        center={[e.lat, e.lng]}
        radius={28}
        pathOptions={{ color: est.color, fillColor: est.color, fillOpacity: 0.25, weight: 1 }}
      />
      <Marker position={[e.lat, e.lng]} icon={edificioIcon(est.color)}>
        <Popup>
          <div className="sos-popup">
            <PopupFoto src={foto} alt={`Foto de ${e.nombre || 'edificio'}`} variant="edificio" />
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
}

export default function EdificiosLayer({ edificios = [], estadoFiltro = 'todos' }) {
  const [modal, setModal] = useState(null);

  const grupos = useMemo(() => {
    const visibles = edificios
      .filter(hasLatLng)
      .filter((e) => estadoFiltro === 'todos' || e.estado === estadoFiltro);
    return agruparPorProximidad(visibles, (e) => e.lat, (e) => e.lng, 4);
  }, [edificios, estadoFiltro]);

  return (
    <>
      <LayerGroup>
        {grupos.map((g) =>
          g.items.length === 1 ? (
            <MarcadorEdificio key={g.items[0].id} e={g.items[0]} />
          ) : (
            <Marker
              key={g.key}
              position={[g.lat, g.lng]}
              icon={clusterIcon(g.items.length, EDIFICIO_CLUSTER_COLOR)}
              eventHandlers={{
                click: () => setModal({ titulo: `${g.items.length} edificios en este lugar`, items: g.items.map(toItem) }),
              }}
            />
          ),
        )}
      </LayerGroup>
      {modal && <ClusterModal titulo={modal.titulo} items={modal.items} onClose={() => setModal(null)} />}
    </>
  );
}
