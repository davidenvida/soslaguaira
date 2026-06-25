import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Fix de iconos de Leaflet con bundlers (Vite no resuelve las rutas por defecto).
const markerIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Centro y zoom de La Guaira (contrato de datos).
const DEFAULT_CENTER = { lat: 10.601, lng: -66.934 }
const DEFAULT_ZOOM = 14

function ClickHandler({ onChange }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

// Recentra el mapa solo cuando cambia `target` (boton de geolocalizacion), no en cada clic.
function FlyToTarget({ target }) {
  const map = useMap()
  if (target) map.flyTo([target.lat, target.lng], 16, { duration: 0.8 })
  return null
}

const round = (n) => Math.round(n * 1e6) / 1e6

export default function LocationPicker({ value, onChange, label = 'Ubicación', required, autoLocate = false }) {
  const [geoStatus, setGeoStatus] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const autoTried = useRef(false)
  const hasValue = value && value.lat != null && value.lng != null

  function usarMiUbicacion() {
    if (!('geolocation' in navigator)) {
      setGeoStatus('Tu navegador no soporta geolocalización.')
      return
    }
    setGeoStatus('Obteniendo ubicación...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        onChange(coords)
        setFlyTarget({ ...coords, _t: Date.now() })
        setGeoStatus(null)
      },
      (err) => {
        const msgs = {
          1: 'Permiso de ubicación denegado. Marca el punto en el mapa.',
          2: 'No se pudo determinar tu ubicación. Marca el punto en el mapa.',
          3: 'Tiempo de espera agotado. Marca el punto en el mapa.',
        }
        setGeoStatus(msgs[err.code] || 'No se pudo obtener tu ubicación.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  // Geolocalización automática al montar (usado en el reporte de personas atrapadas).
  useEffect(() => {
    if (autoLocate && !autoTried.current && !hasValue) {
      autoTried.current = true
      usarMiUbicacion()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLocate])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-600">*</span>}
        </span>
        <button
          type="button"
          onClick={usarMiUbicacion}
          className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
        >
          📍 Usar mi ubicación
        </button>
      </div>

      <div className="h-56 w-full overflow-hidden rounded-lg border border-gray-300">
        <MapContainer
          center={hasValue ? [value.lat, value.lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
          zoom={hasValue ? 16 : DEFAULT_ZOOM}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onChange={onChange} />
          <FlyToTarget target={flyTarget} />
          {hasValue && (
            <Marker
              position={[value.lat, value.lng]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend(e) {
                  const ll = e.target.getLatLng()
                  onChange({ lat: ll.lat, lng: ll.lng })
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-gray-500">
        Toca el mapa o arrastra el marcador para fijar el punto.
        {hasValue && (
          <span className="ml-1 font-medium text-gray-700">
            ({round(value.lat)}, {round(value.lng)})
          </span>
        )}
      </p>
      {geoStatus && <p className="text-xs font-medium text-amber-600">{geoStatus}</p>}
    </div>
  )
}

export { DEFAULT_CENTER }
