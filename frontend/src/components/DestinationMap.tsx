import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { coordinateFor, type LatLng } from '../lib/coordinates'
import { useLang } from '../lib/lang'

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

const VISITED_COLOR = '#d97706'
const NOT_VISITED_COLOR = '#94a3b8'

function pointIcon(visited: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${visited ? VISITED_COLOR : NOT_VISITED_COLOR};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  })
}

function MoveTo({ position }: { position: LatLng }) {
  const map = useMap()
  useEffect(() => {
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 9))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.lat, position.lng])
  return null
}

export interface MapPoint {
  name: string
  lat: number
  lng: number
  visited?: boolean
}

interface DestinationMapProps {
  name: string
  points?: MapPoint[]
}

export default function DestinationMap({ name, points = [] }: DestinationMapProps) {
  const { t } = useLang()
  const pos = coordinateFor(name)
  if (!pos) return null
  const center: LatLng = { lat: pos.lat, lng: pos.lng }

  return (
    <div className="relative h-full w-full" style={{ minHeight: 300 }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={9}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MoveTo position={center} />
        <Marker position={[center.lat, center.lng]} icon={icon}>
          <Popup>{name}</Popup>
        </Marker>
        {points.map((p) => (
          <Marker key={p.name} position={[p.lat, p.lng]} icon={pointIcon(p.visited ?? false)}>
            <Popup>
              {p.name}
              <br />
              {p.visited ? t('visit.visited') : t('visit.notVisited')}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {points.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[1000] rounded-md bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-md">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: VISITED_COLOR }} />
            <span>{t('visit.visited')}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: NOT_VISITED_COLOR }} />
            <span>{t('visit.notVisited')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export { DEFAULT_CENTER, DEFAULT_ZOOM }