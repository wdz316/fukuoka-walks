import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { coordinateFor, type LatLng } from '../lib/coordinates'

const DEFAULT_CENTER: LatLng = { lat: 20, lng: 30 }
const DEFAULT_ZOOM = 2

const icon = L.icon({
  iconUrl:
    'data:image/svg+xml;base64,' +
    btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path fill="#e11d48" d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/><circle cx="12.5" cy="12.5" r="5" fill="#fff"/></svg>`,
    ),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

function MoveTo({ position }: { position: LatLng }) {
  const map = useMap()
  useEffect(() => {
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 9))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.lat, position.lng])
  return null
}

interface DestinationMapProps {
  name: string
}

export default function DestinationMap({ name }: DestinationMapProps) {
  const pos = coordinateFor(name)
  if (!pos) return null
  const center: LatLng = { lat: pos.lat, lng: pos.lng }

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={9}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ minHeight: 300 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MoveTo position={center} />
      <Marker position={[center.lat, center.lng]} icon={icon}>
        <Popup>{name}</Popup>
      </Marker>
    </MapContainer>
  )
}

export { DEFAULT_CENTER, DEFAULT_ZOOM }
