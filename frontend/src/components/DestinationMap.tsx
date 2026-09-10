import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
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

function pointIcon(visited: boolean, included = true): L.DivIcon {
  if (!included) {
    return L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:#fff;border:2px dashed ${NOT_VISITED_COLOR};box-shadow:0 1px 3px rgba(0,0,0,0.35)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -10],
    })
  }
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
  /** False = tapped off the route (hollow marker, not connected). */
  included?: boolean
}

interface DestinationMapProps {
  name: string
  points?: MapPoint[]
  /** Tap a marker to toggle it in/out of the route. Enables edit mode. */
  onTogglePoint?: (name: string) => void
  /** Drag a marker to adjust its position on the route. */
  onMovePoint?: (name: string, lat: number, lng: number) => void
}

function isInteractive(props: Pick<DestinationMapProps, 'onTogglePoint' | 'onMovePoint'>): boolean {
  return props.onTogglePoint != null || props.onMovePoint != null
}

export default function DestinationMap({ name, points = [], onTogglePoint, onMovePoint }: DestinationMapProps) {
  const { t } = useLang()
  const pos = coordinateFor(name)
  if (!pos) return null
  const center: LatLng = { lat: pos.lat, lng: pos.lng }
  const interactive = isInteractive({ onTogglePoint, onMovePoint })
  const routeLine: [number, number][] = points
    .filter((p) => p.included !== false)
    .map((p) => [p.lat, p.lng])

  return (
    <div className="relative h-full w-full" style={{ minHeight: 300 }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={9}
        scrollWheelZoom
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
        {routeLine.length > 1 && (
          <Polyline positions={routeLine} pathOptions={{ color: '#2563eb', weight: 3, dashArray: '8,6' }} />
        )}
        {points.map((p) => {
          const included = p.included !== false
          return (
            <Marker
              key={p.name}
              position={[p.lat, p.lng]}
              icon={pointIcon(p.visited ?? false, included)}
              draggable={interactive}
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng()
                  onMovePoint?.(p.name, ll.lat, ll.lng)
                },
              }}
            >
              <Popup>
                <div>
                  <div>
                    {p.name}
                  </div>
                  <div>
                    {p.visited ? t('visit.visited') : t('visit.notVisited')}
                    {!included && (
                      <>
                        <br />
                        {t('visit.routeExcluded')}
                      </>
                    )}
                  </div>
                  {onTogglePoint && (
                    <button
                      type="button"
                      onClick={() => onTogglePoint(p.name)}
                      style={{
                        marginTop: 6,
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #c7d2fe',
                        background: included ? '#fff' : '#eef2ff',
                        color: '#2563eb',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {included ? t('visit.removeFromRoute') : t('visit.addToRouteBtn')}
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
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
          {interactive && (
            <div className="mt-1 flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full bg-white"
                style={{ border: `2px dashed ${NOT_VISITED_COLOR}` }}
              />
              <span>{t('visit.routeExcluded')}</span>
            </div>
          )}
        </div>
      )}
      {interactive && (
        <div className="absolute left-1/2 top-3 z-[1000] max-w-[80%] -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/80 px-3 py-1.5 text-xs text-white shadow-md">
          {t('plan.mapHint')}
        </div>
      )}
    </div>
  )
}

export { DEFAULT_CENTER, DEFAULT_ZOOM }