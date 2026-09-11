import { describe, expect, it } from 'vitest'
import { createMockApi } from './mock'
import { buildRoute, mergeCustomPlaces } from './routePlan'
import type { PlaceInfo } from './types'

describe('MockApi spots (自建地点)', () => {
  it('listSpots starts empty, createSpot records it, deleteSpot removes it', async () => {
    const api = createMockApi()
    expect(await api.listSpots()).toEqual([])
    const spot = await api.createSpot({
      name: 'もつ鍋やまや',
      description: 'ホルモン絶品',
      lat: 33.5904,
      lng: 130.4017,
      destination_id: 11,
    })
    expect(spot.id).toBeGreaterThan(0)
    expect(spot.name).toBe('もつ鍋やまや')
    const list = await api.listSpots()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      name: 'もつ鍋やまや',
      description: 'ホルモン絶品',
      lat: 33.5904,
      lng: 130.4017,
      destination_id: 11,
    })
    await api.deleteSpot(spot.id)
    expect(await api.listSpots()).toEqual([])
  })

  it('uploadSpotPhoto returns a data URL with the file mime type', async () => {
    const api = createMockApi()
    const file = new File(['fake-image-bytes'], 'photo.png', { type: 'image/png' })
    const { url } = await api.uploadSpotPhoto(file)
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('listSpots filters by destination_id', async () => {
    const api = createMockApi()
    const a = await api.createSpot({
      name: '天神地下街',
      lat: 33.5904,
      lng: 130.4017,
      destination_id: 11,
    })
    await api.createSpot({
      name: '別の街のスポット',
      lat: 35.0116,
      lng: 135.7681,
      destination_id: 999,
    })
    const only = await api.listSpots(11)
    expect(only.map((s) => s.name)).toEqual(['天神地下街'])
    expect(a.lat).toBe(33.5904)
  })

  it('createSpot persists photo_url when provided', async () => {
    const api = createMockApi()
    const spot = await api.createSpot({
      name: '写真付きスポット',
      photo_url: 'data:image/jpeg;base64,abc',
      lat: 33.5904,
      lng: 130.4017,
    })
    expect(spot.photo_url).toBe('data:image/jpeg;base64,abc')
    expect((await api.listSpots())[0].photo_url).toBe('data:image/jpeg;base64,abc')
  })

  it('deleteSpot rejects an unknown id', async () => {
    const api = createMockApi()
    await expect(api.deleteSpot(424242)).rejects.toThrow('Spot not found')
  })
})

describe('mergeCustomPlaces with spot fields (自建地点)', () => {
  const kushida: PlaceInfo = { name: '櫛田神社', day: 1 }

  it('carries description and photo_url into the custom route stop', () => {
    const route = buildRoute([kushida], [])
    const merged = mergeCustomPlaces(route, [
      {
        name: 'もつ鍋やまや',
        description: 'ホルモン絶品',
        photo_url: 'data:image/png;base64,x',
        lat: 33.5904,
        lng: 130.4017,
      },
    ])
    const last = merged[merged.length - 1]
    expect(last).toMatchObject({ day: null, isCustom: true })
    expect(last.stops[0]).toMatchObject({
      name: 'もつ鍋やまや',
      kind: 'custom',
      description: 'ホルモン絶品',
      photo_url: 'data:image/png;base64,x',
    })
  })

  it('merges a spot with only name and coordinates', () => {
    const merged = mergeCustomPlaces([], [
      { name: '天神地下街', lat: 33.5904, lng: 130.4017 },
    ])
    expect(merged[0].stops[0]).toMatchObject({
      name: '天神地下街',
      kind: 'custom',
      description: undefined,
      photo_url: undefined,
    })
  })
})