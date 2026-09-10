import { describe, expect, it } from 'vitest'
import { coordinateFor } from './coordinates'

describe('coordinateFor', () => {
  it('returns coordinates for known destinations', () => {
    expect(coordinateFor('Kyoto')).toEqual({ lat: 35.0116, lng: 135.7681 })
    expect(coordinateFor('Tokyo')).toEqual({ lat: 35.6762, lng: 139.6503 })
    expect(coordinateFor('Paris')).toEqual({ lat: 48.8566, lng: 2.3522 })
  })

  it('returns Fukuoka coordinates (足迹 city-tour target)', () => {
    expect(coordinateFor('Fukuoka')).toEqual({ lat: 33.5904, lng: 130.4017 })
    expect(coordinateFor('福岡')).toEqual({ lat: 33.5904, lng: 130.4017 })
  })

  it('returns null for unknown destinations', () => {
    expect(coordinateFor('Atlantis')).toBeNull()
    expect(coordinateFor(undefined)).toBeNull()
    expect(coordinateFor('')).toBeNull()
  })

  it('returns null for empty name', () => {
    expect(coordinateFor('  ')).toBeNull()
  })
})
