import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'

// Centro del mapa: La Guaira / Vargas (contrato de datos).
export const LA_GUAIRA = { lat: 10.6010, lng: -66.9340, zoom: 13 }

// Captura clics en el mapa y los reporta (para que los formularios fijen ubicación).
function ClickCapture({ onPick }) {
  useMapEvents({
    click(e) {
      if (onPick) onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

// Recentra el mapa cuando cambia `target` ({ lat, lng, zoom? }) — para "Ver en mapa".
function Recenter({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target && target.lat != null && target.lng != null) {
      map.flyTo([target.lat, target.lng], target.zoom || 17, { duration: 0.8 })
    }
  }, [target, map])
  return null
}

// Mapa base reutilizable. Las capas (personas/atrapados/edificios) se pasan como children.
// Props:
//   - onPick(latlng): callback opcional al hacer clic (modo "fijar ubicación")
//   - target({lat,lng,zoom?}): al cambiar, recentra el mapa (botón "Ver en mapa")
//   - children: capas de marcadores (las construye Gio en components/map/)
export default function MapBase({ onPick, target, children, center = LA_GUAIRA }) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={center.zoom}
      scrollWheelZoom={true}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onPick && <ClickCapture onPick={onPick} />}
      <Recenter target={target} />
      {children}
    </MapContainer>
  )
}
