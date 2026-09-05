import { describe, expect, it } from 'vitest'
import { buildRoute } from './routePlan'
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
})
