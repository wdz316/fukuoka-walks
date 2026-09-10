import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearFootCache,
  clearTransitCache,
  decodePolyline,
  fetchFootPath,
  fetchTransitPath,
} from './routing'

describe('decodePolyline', () => {
  it('decodes the canonical polyline5 example', () => {
    // Encodes (38.5,-120.2) (40.7,-120.95) (43.252,-126.453).
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ])
  })

  it('decodes polyline6 (Valhalla precision)', () => {
    // Same points at precision 6.
    const pts = decodePolyline('_izlhA~rlgdF_{geC~ywl@_kwzCn`{nI', 6)
    expect(pts).toHaveLength(3)
    expect(pts[0][0]).toBeCloseTo(38.5, 4)
    expect(pts[0][1]).toBeCloseTo(-120.2, 4)
    expect(pts[2][0]).toBeCloseTo(43.252, 4)
    expect(pts[2][1]).toBeCloseTo(-126.453, 4)
  })

  it('returns empty for empty input', () => {
    expect(decodePolyline('')).toEqual([])
  })
})

describe('fetchFootPath', () => {
  afterEach(() => {
    clearFootCache()
    clearTransitCache()
    vi.unstubAllGlobals()
  })

  it('returns decoded geometry on Ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: 'Ok', routes: [{ geometry: '_p~iF~ps|U_ulLnnqC' }] }),
      }),
    )
    const path = await fetchFootPath({ lat: 0, lng: 0 }, { lat: 1, lng: 1 })
    expect(path).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
    ])
  })

  it('returns null and caches on failure', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', spy)
    const a = { lat: 0, lng: 0 }
    const b = { lat: 1, lng: 1 }
    expect(await fetchFootPath(a, b)).toBeNull()
    expect(await fetchFootPath(a, b)).toBeNull()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('fetchTransitPath', () => {
  afterEach(() => {
    clearTransitCache()
    vi.unstubAllGlobals()
  })

  it('posts multimodal to Valhalla and decodes polyline6', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ trip: { legs: [{ shape: '_izlhA~rlgdF_{geC~ywl@_kwzCn`{nI' }] } }),
    })
    vi.stubGlobal('fetch', spy)
    const path = await fetchTransitPath({ lat: 0, lng: 0 }, { lat: 1, lng: 1 })
    expect(path).toHaveLength(3)
    expect(spy).toHaveBeenCalledTimes(1)
    const [, opts] = spy.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body as string) as { costing: string }
    expect(body.costing).toBe('multimodal')
  })

  it('returns null when Valhalla has no shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ trip: { legs: [] } }) }),
    )
    expect(await fetchTransitPath({ lat: 0, lng: 0 }, { lat: 1, lng: 1 })).toBeNull()
  })
})
