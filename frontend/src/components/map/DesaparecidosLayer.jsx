// Capa de DESAPARECIDOS (intel geocodificado). Marcador rosa, distinto de las
// otras capas. Popup con foto, nombre, estado (badge) y enlace a la fuente.
//
// Anti-colisión: muchos intel caen en el mismo punto del gazetteer (centroide de
// parroquia como fallback). Para que no se tapen, los que comparten exactamente
// las mismas coordenadas se reparten en un pequeño círculo (determinista por
// índice). Los puntos únicos se dejan exactos.
import { LayerGroup, Marker, Popup } from 'react-leaflet';
import { personaEstado } from './mapColors';
import { desaparecidoIcon } from './markerIcons';
import PopupFoto from './PopupFoto';
import FuenteIcono from '../ui/FuenteIcono';
import { resolveFoto, hasLatLng } from './fields';

const nombre = (d) => d.nombre_completo || d.nombreCompleto || d.nombre || 'Sin nombre';
const ubicacion = (d) => d.ultima_ubicacion || d.ultimaUbicacion || d.parroquia || '';
const fuente = (d) => d.fuente_url || d.fuenteUrl || '';

// Radio del reparto en grados (~11 m por cada 0.0001). Pequeño pero visible.
const SPREAD = 0.00018;

// Reparte en círculo los registros que comparten coordenada exacta.
function despuntar(lista) {
  const grupos = new Map();
  for (const d of lista) {
    const k = `${d.lat.toFixed(5)},${d.lng.toFixed(5)}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(d);
  }
  const out = [];
  for (const grupo of grupos.values()) {
    if (grupo.length === 1) {
      out.push({ d: grupo[0], lat: grupo[0].lat, lng: grupo[0].lng });
      continue;
    }
    const n = grupo.length;
    grupo.forEach((d, i) => {
      const ang = (2 * Math.PI * i) / n;
      // corrige la longitud por la latitud para que el círculo no se deforme
      const cosLat = Math.cos((d.lat * Math.PI) / 180) || 1;
      out.push({
        d,
        lat: d.lat + SPREAD * Math.sin(ang),
        lng: d.lng + (SPREAD * Math.cos(ang)) / cosLat,
      });
    });
  }
  return out;
}

export default function DesaparecidosLayer({ desaparecidos = [], estadoFiltro = 'todos' }) {
  const visibles = desaparecidos
    .filter(hasLatLng)
    .filter((d) => estadoFiltro === 'todos' || d.estado === estadoFiltro);

  const ubicados = despuntar(visibles);

  return (
    <LayerGroup>
      {ubicados.map(({ d, lat, lng }) => {
        const est = personaEstado(d.estado);
        const foto = resolveFoto(d);
        const nom = nombre(d);
        const url = fuente(d);
        return (
          <Marker key={d.id} position={[lat, lng]} icon={desaparecidoIcon()}>
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
      })}
    </LayerGroup>
  );
}
