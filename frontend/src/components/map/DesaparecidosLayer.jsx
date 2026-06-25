// Capa de DESAPARECIDOS (intel geocodificado). Marcador rosa, distinto de las
// otras capas. Popup con foto, nombre, estado (badge) y enlace a la fuente.
//
// CLUSTERING: muchos intel caen en el mismo punto (centroide de parroquia o
// mismo edificio). En vez de amontonar marcadores, se agrupan por proximidad:
// 1 reporte -> marcador normal; varios -> UN marcador-cluster con el número, que
// al hacer clic abre un modal con la lista (todos clickeables).
//
// `destacarId`: al navegar "Ver en el mapa" desde el directorio, si la persona
// es un marcador suelto se agranda y abre su popup; si cae en un cluster, se
// abre el modal de ese cluster.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayerGroup, Marker, Popup } from 'react-leaflet';
import { personaEstado } from './mapColors';
import { desaparecidoIcon, clusterIcon, DESAPARECIDO_COLOR } from './markerIcons';
import { agruparPorProximidad } from './clustering';
import ClusterModal from './ClusterModal';
import PersonaDetalle from '../desaparecidos/PersonaDetalle';
import PopupFoto from './PopupFoto';
import FuenteIcono from '../ui/FuenteIcono';
import { resolveFoto, hasLatLng } from './fields';

const nombre = (d) => d.nombre_completo || d.nombreCompleto || d.nombre || 'Sin nombre';
const ubicacion = (d) => d.ultima_ubicacion || d.ultimaUbicacion || d.parroquia || '';
const fuente = (d) => d.fuente_url || d.fuenteUrl || '';

// Normaliza un reporte al formato que consume ClusterModal. `raw` lleva el
// registro completo para abrir la ficha (PersonaDetalle) al seleccionarlo.
const toItem = (d) => {
  const est = personaEstado(d.estado);
  return {
    id: d.id,
    fotoSrc: resolveFoto(d),
    titulo: nombre(d),
    subtitulo: ubicacion(d),
    badgeLabel: est.label,
    badgeColor: est.color,
    fuenteUrl: fuente(d),
    raw: d,
  };
};

function MarcadorDesaparecido({ d, lat, lng, destacado }) {
  const ref = useRef(null);
  useEffect(() => {
    if (destacado && ref.current) ref.current.openPopup();
  }, [destacado]);

  const est = personaEstado(d.estado);
  const foto = resolveFoto(d);
  const nom = nombre(d);
  const url = fuente(d);

  return (
    <Marker
      ref={ref}
      position={[lat, lng]}
      icon={desaparecidoIcon(destacado)}
      zIndexOffset={destacado ? 1000 : 0}
    >
      <Popup>
        <div className="sos-popup">
          <PopupFoto src={foto} alt={`Foto de ${nom}`} />
          <div className="sos-popup__body">
            <span className="sos-popup__badge" style={{ background: est.color }}>
              {est.label}
            </span>
            <div className="sos-popup__title">{nom}</div>
            {ubicacion(d) && (
              <div className="sos-popup__row">
                <span className="sos-popup__label">Última ubicación: </span>
                {ubicacion(d)}
              </div>
            )}
            {d.parroquia && (
              <div className="sos-popup__row">
                <span className="sos-popup__label">Parroquia: </span>
                {d.parroquia}
              </div>
            )}
            {url && (
              <div className="sos-popup__row" style={{ marginTop: 8 }}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <FuenteIcono url={url} />
                  Ver publicación
                </a>
              </div>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default function DesaparecidosLayer({
  desaparecidos = [],
  estadoFiltro = 'todos',
  destacarId = null,
  onPersonaUpdate,
}) {
  const [modal, setModal] = useState(null); // { titulo, items } | null
  const [detalle, setDetalle] = useState(null); // persona | null

  const grupos = useMemo(() => {
    const visibles = desaparecidos
      .filter(hasLatLng)
      .filter((d) => estadoFiltro === 'todos' || d.estado === estadoFiltro);
    return agruparPorProximidad(visibles, (d) => d.lat, (d) => d.lng, 4);
  }, [desaparecidos, estadoFiltro]);

  const abrirModal = (g) =>
    setModal({ titulo: `${g.items.length} reportes en este lugar`, items: g.items.map(toItem) });

  // Si el target navegado cae dentro de un cluster, abre ese modal.
  useEffect(() => {
    if (destacarId == null) return;
    const g = grupos.find(
      (grp) => grp.items.length > 1 && grp.items.some((d) => String(d.id) === String(destacarId)),
    );
    if (g) abrirModal(g);
  }, [destacarId, grupos]);

  return (
    <>
      <LayerGroup>
        {grupos.map((g) =>
          g.items.length === 1 ? (
            <MarcadorDesaparecido
              key={g.items[0].id}
              d={g.items[0]}
              lat={g.lat}
              lng={g.lng}
              destacado={destacarId != null && String(g.items[0].id) === String(destacarId)}
            />
          ) : (
            <Marker
              key={g.key}
              position={[g.lat, g.lng]}
              icon={clusterIcon(g.items.length, DESAPARECIDO_COLOR)}
              eventHandlers={{ click: () => abrirModal(g) }}
            />
          ),
        )}
      </LayerGroup>
      {modal && (
        <ClusterModal
          titulo={modal.titulo}
          items={modal.items}
          onClose={() => setModal(null)}
          onSelect={(p) => setDetalle(p)}
        />
      )}
      {detalle && (
        <PersonaDetalle
          persona={detalle}
          onClose={() => setDetalle(null)}
          onUpdate={() => onPersonaUpdate?.()}
        />
      )}
    </>
  );
}
