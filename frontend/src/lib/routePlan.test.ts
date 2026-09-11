import { describe, expect, it } from 'vitest'
import { buildRoute, mergeCustomPlaces, planLegs } from './routePlan'
import type { PlaceInfo } from './types'

const kushida: PlaceInfo = { name: '櫛田神社', day: 1, url: 'https://example.com/kushida' }
const ohori: PlaceInfo = { name: '大濠公園', day: 1 }
const dazaifu: PlaceInfo = { name: '太宰府天満宮', day: 2 }
const hotel: PlaceInfo = { name: 'ホテル日航福岡', day: 1, booking_url: 'https://example.com/book' }

describe('buildRoute', () => {
  it('groups attractions by day with 午前/午後/夕方 slots in order', () => {
    const days = buildRoute([kushida, ohori, dazaifu], [])
    expect(days.map((d) => d.day)).toEqual([1, 2])
    expect(days[0].stops.map((s) => s.timeLabel)).toEqual(['午前', '午後'])
    expect(days[0].stops.map((s) => s.name)).toEqual(['櫛田神社', '大濠公園'])
    expect(days[1].stops[0]).toMatchObject({ name: '太宰府天満宮', timeLabel: '午前' })
  })

  it('appends hotels as 宿泊 stops and keeps links', () => {
    const days = buildRoute([kushida], [hotel])
    expect(days).toHaveLength(1)
    const last = days[0].stops[days[0].stops.length - 1]
    expect(last).toMatchObject({
      name: 'ホテル日航福岡',
      timeLabel: '宿泊',
      kind: 'hotel',
      booking_url: 'https://example.com/book',
    })
    expect(days[0].stops[0].url).toBe('https://example.com/kushida')
  })

  it('groups day-less stops under null and returns empty for no data', () => {
    expect(buildRoute([], [])).toEqual([])
    expect(buildRoute(null, undefined)).toEqual([])
    const days = buildRoute([{ name: '天神地下街' }], [])
    expect(days).toHaveLength(1)
    expect(days[0].day).toBeNull()
    expect(days[0].stops[0].timeLabel).toBe('午前')
  })

  it('drops later days and hotels on a 1-day trip', () => {
    const days = buildRoute([kushida, ohori, dazaifu], [hotel], {
      days: 1,
      includeHotels: false,
    })
    expect(days.map((d) => d.day)).toEqual([1])
    expect(days[0].stops.map((s) => s.name)).toEqual(['櫛田神社', '大濠公園'])
    expect(days[0].stops.every((s) => s.kind === 'attraction')).toBe(true)
  })

  it('keeps hotels on multi-day trips', () => {
    const days = buildRoute([kushida, dazaifu], [hotel], {
      days: 2,
      includeHotels: true,
    })
    expect(days.map((d) => d.day)).toEqual([1, 2])
    expect(days[0].stops.some((s) => s.kind === 'hotel')).toBe(true)
  })

  it('caps main stops at 3 per day and parks overflow as extras', () => {    const many = [1, 2, 3, 4, 5].map((i) => ({ name: ` spot${i} `.trim(), day: 1 }))
    const days = buildRoute(many, [], { days: 2 })
    expect(days).toHaveLength(1)
    expect(days[0].stops.map((s) => s.timeLabel)).toEqual(['午前', '午後', '夕方'])
    expect(days[0].extras.map((s) => s.name)).toEqual(['spot4', 'spot5'])
  })
})

describe('mergeCustomPlaces', () => {
  it('appends custom places to the route tail in an isCustom day', () => {
    const days = buildRoute([kushida, dazaifu], [])
    const merged = mergeCustomPlaces(days, [{ name: 'もつ鍋やまや', note: 'ホルモン' }])
    expect(merged).toHaveLength(3)
    const last = merged[merged.length - 1]
    expect(last).toMatchObject({ day: null, isCustom: true })
    expect(last.stops[0]).toMatchObject({
      name: 'もつ鍋やまや',
      timeLabel: '自定',
      transport: '',
      kind: 'custom',
      note: 'ホルモン',
    })
    expect(last.extras).toEqual([])
  })

  it('returns the route unchanged when there are no custom places', () => {
    const days = buildRoute([kushida], [])
    expect(mergeCustomPlaces(days, [])).toBe(days)
  })

  it('produces a custom-only day when the scheduled route is empty', () => {
    const merged = mergeCustomPlaces([], [{ name: '天神地下街' }])
    expect(merged).toHaveLength(1)
    expect(merged[0].stops[0]).toMatchObject({ name: '天神地下街', kind: 'custom' })
  })

  it('appends multiple custom places in order with optional notes', () => {
    const merged = mergeCustomPlaces(
      [],
      [{ name: 'A' }, { name: 'B', note: 'メモ' }],
    )
    expect(merged[0].stops.map((s) => s.name)).toEqual(['A', 'B'])
    expect(merged[0].stops.map((s) => s.note)).toEqual([undefined, 'メモ'])
  })
})

describe('planLegs', () => {
  const a = { name: 'A', lat: 33.5957, lng: 130.4146 }
  const near = { name: 'B', lat: 33.5967, lng: 130.4156 }
  const far = { name: 'C', lat: 33.5315, lng: 130.5357 }

  it('walks short legs and transits long ones with minutes', () => {
    const legs = planLegs([a, near, far])
    expect(legs).toHaveLength(2)
    expect(legs[0]).toMatchObject({ from: 'A', to: 'B', mode: 'walk' })
    expect(legs[0].minutes).toBeGreaterThanOrEqual(1)
    expect(legs[0].fare).toBe(0)
    expect(legs[1]).toMatchObject({ from: 'B', to: 'C', mode: 'transit' })
    expect(legs[1].minutes).toBeGreaterThan(legs[0].minutes)
    expect(legs[1].fare).toBeGreaterThan(0)
  })

  it('returns empty for fewer than two points', () => {
    expect(planLegs([])).toEqual([])
    expect(planLegs([a])).toEqual([])
  })

  it('names the concrete line when both ends share one', () => {
    const gion = { ...a, station: { name: '祇園駅', line: '地下鉄空港線' } }
    const ohori = { ...near, station: { name: '大濠公園駅', line: '地下鉄空港線' } }
    const [leg] = planLegs([gion, ohori])
    expect(leg.line).toBe('地下鉄空港線（祇園駅→大濠公園駅）')
  })

  it('leaves line undefined across different lines or missing stations', () => {
    const dazaifu = { ...far, station: { name: '太宰府駅', line: '西鉄太宰府線' } }
    const gion = { ...a, station: { name: '祇園駅', line: '地下鉄空港線' } }
    expect(planLegs([gion, dazaifu])[0].line).toBeUndefined()
    expect(planLegs([a, near])[0].line).toBeUndefined()
  })
})

describe('buildRoute origin', () => {
  it('prepends the starting point as the first stop of day 1', () => {
    const days = buildRoute([{ name: 'X', day: 1 }], [], {
      origin: { name: '博多站', lat: 33.5897, lng: 130.4207, timeLabel: '09:00' },
    })
    expect(days[0].stops[0]).toMatchObject({ name: '博多站', timeLabel: '09:00' })
  })

  it('creates day 1 when there are no other stops', () => {
    const days = buildRoute([], [], {
      origin: { name: '博多站', lat: 33.5897, lng: 130.4207 },
    })
    expect(days).toHaveLength(1)
    expect(days[0].stops[0].name).toBe('博多站')
  })
})
