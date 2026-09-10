import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { coordinateFor, type LatLng } from '../lib/coordinates'
import { useLang } from '../lib/lang'
import { fetchFootPath, fetchTransitPath } from '../lib/routing'
import { planLegs } from '../lib/routePlan'

const DEFAULT_CENTER: LatLng = { lat: 20, lng: 30 }
const DEFAULT_ZOOM = 2

const VISITED_COLOR = '#d97706'
const NOT_VISITED_COLOR = '#94a3b8'

function orderedIcon(order: number, visited: boolean, included = true): L.DivIcon {
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
    html: `<div style="min-width:22px;height:22px;border-radius:11px;background:${visited ? VISITED_COLOR : '#2563eb'};color:#fff;font-size:12px;font-weight:700;line-height:22px;text-align:center;padding:0 4px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35)">${order}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
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
  const interactive = isInteractive({ onTogglePoint, onMovePoint })
  const includedPoints = points.filter((p) => p.included !== false)
  const legs = planLegs(includedPoints)
  const legByFrom = new Map(legs.map((l) => [l.from, l]))
  const legByTo = new Map(legs.map((l) => [l.to, l]))
  const orderOf = new Map(includedPoints.map((p, i) => [p.name, i + 1]))

  // Real geometry: walk legs via OSRM foot, transit legs via Valhalla
  // multimodal. Either falls back to a straight dashed line when the
  // public service has no data for the area.
  const [footPaths, setFootPaths] = useState<Record<string, [number, number][]>>({})
  const [transitPaths, setTransitPaths] = useState<Record<string, [number, number][]>>({})
  useEffect(() => {
    const ctrl = new AbortController()
    let cancelled = false
    const byName = new Map(includedPoints.map((p) => [p.name, p]))
    if (legs.length === 0) {
      setFootPaths({})
      setTransitPaths({})
      return () => ctrl.abort()
    }
    void (async () => {
      const foot: Record<string, [number, number][]> = {}
      const transit: Record<string, [number, number][]> = {}
      await Promise.all(
        legs.map(async (l) => {
          const a = byName.get(l.from)
          const b = byName.get(l.to)
          if (!a || !b) return
          const path =
            l.mode === 'walk'
              ? await fetchFootPath(a, b, ctrl.signal)
              : await fetchTransitPath(a, b, ctrl.signal)
          if (path) (l.mode === 'walk' ? foot : transit)[`${l.from}-${l.to}`] = path
        }),
      )
      if (!cancelled) {
        setFootPaths(foot)
        setTransitPaths(transit)
      }
    })()
    return () => {
      cancelled = true
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  if (!pos) return null
  const center: LatLng = { lat: pos.lat, lng: pos.lng }

const WALK_COLOR = '#16a34a'
const TRANSIT_COLOR = '#2563eb'

function legDetail(t: (key: string, params?: Record<string, string | number>) => string, leg: { mode: string; minutes: number }): string {
  return `${t(leg.mode === 'walk' ? 'plan.walkMode' : 'plan.transitMode')} ${t('plan.minutes', { n: leg.minutes })}`
}

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
        {legs.map((leg) => {
          const a = includedPoints.find((p) => p.name === leg.from)
          const b = includedPoints.find((p) => p.name === leg.to)
          if (!a || !b) return null
          const isWalk = leg.mode === 'walk'
          const routed = isWalk
            ? footPaths[`${leg.from}-${leg.to}`]
            : transitPaths[`${leg.from}-${leg.to}`]
          const positions: [number, number][] = routed ?? [
            [a.lat, a.lng],
            [b.lat, b.lng],
          ]
          const color = isWalk ? WALK_COLOR : TRANSIT_COLOR
          return (
            <Polyline
              key={`${leg.from}-${leg.to}`}
              positions={positions}
              pathOptions={{
                color,
                weight: 4,
                dashArray: routed ? undefined : isWalk ? '2,6' : '8,6',
                lineCap: 'round',
              }}
            />
          )
        })}
        {points.map((p) => {
          const included = p.included !== false
          const order = orderOf.get(p.name) ?? 0
          const next = legByFrom.get(p.name)
          const prev = legByTo.get(p.name)
          return (
            <Marker
              key={p.name}
              position={[p.lat, p.lng]}
              icon={orderedIcon(order, p.visited ?? false, included)}
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
                    {included ? `${order}. ` : ''}{p.name}
                  </div>
                  <div>
                    {p.visited ? t('visit.visited') : t('visit.notVisited')}
                    {included && prev && (
                      <>
                        <br />
                        {t('plan.arriveBy', {
                          from: prev.from,
                          detail: legDetail(t, prev),
                        })}
                      </>
                    )}
                    {included && next && (
                      <>
                        <br />
                        {t('plan.nextStop', {
                          to: next.to,
                          detail: legDetail(t, next),
                        })}
                      </>
                    )}
                    {included && !prev && !next && (
                      <>
                        <br />
                        {t('plan.lastStop')}
                      </>
                    )}
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
          <div className="mt-1 flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-4"
              style={{ background: WALK_COLOR }}
            />
            <span>{t('plan.walkMode')}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="inline-block h-0 w-4 border-t-2"
              style={{ borderColor: TRANSIT_COLOR }}
            />
            <span>{t('plan.transitMode')}</span>
          </div>
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