import { describe, expect, it } from 'vitest'
import {
  canonicalCityAlias,
  collectVisitedDestinationIds,
  destinationNameMatches,
  filterNewDestinations,
  isSameCity,
  normalizeCity,
} from './places'

describe('normalizeCity', () => {
  it('folds case and whitespace', () => {
    expect(normalizeCity('  FUKUOKA  ShI ')).toBe('fukuoka')
  })

  it('folds full-width characters', () => {
    expect(normalizeCity('ＴＯＫＹＯ')).toBe('tokyo')
    expect(normalizeCity('福岡')).toBe('福岡')
  })

  it('strips city suffixes', () => {
    expect(normalizeCity('tokyo city')).toBe('tokyo')
    expect(normalizeCity('京都市')).toBe('京都')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeCity(null)).toBe('')
    expect(normalizeCity('')).toBe('')
  })
})

describe('canonicalCityAlias', () => {
  it('resolves romaji / Japanese / Chinese variants', () => {
    expect(canonicalCityAlias('fukuoka')).toBe('fukuoka')
    expect(canonicalCityAlias('福岡')).toBe('fukuoka')
    expect(canonicalCityAlias('福冈')).toBe('fukuoka')
    expect(canonicalCityAlias('京都')).toBe('kyoto')
    expect(canonicalCityAlias('首尔')).toBe('seoul')
  })

  it('returns null for unknown cities', () => {
    expect(canonicalCityAlias('nowhere')).toBeNull()
  })
})

describe('isSameCity', () => {
  it('detects normalized same-city across scripts', () => {
    expect(isSameCity('福冈', 'fukuoka')).toBe(true)
    expect(isSameCity('福岡', 'fukuoka')).toBe(true)
    expect(isSameCity('Tokyo', '東京')).toBe(true)
  })

  it('rejects different cities', () => {
    expect(isSameCity('東京', '大阪')).toBe(false)
    expect(isSameCity('fukuoka', 'osaka')).toBe(false)
  })

  it('rejects empty input', () => {
    expect(isSameCity('', 'fukuoka')).toBe(false)
  })
})

describe('destinationNameMatches', () => {
  it('matches exact and localized names', () => {
    expect(destinationNameMatches('Fukuoka', 'fukuoka')).toBe(true)
    expect(destinationNameMatches('Fukuoka', '福岡')).toBe(true)
    expect(destinationNameMatches('Kyoto', '京都')).toBe(true)
  })

  it('rejects unrelated names', () => {
    expect(destinationNameMatches('Osaka', 'Fukuoka')).toBe(false)
    expect(destinationNameMatches('Kyoto', '')).toBe(false)
  })
})

describe('collectVisitedDestinationIds', () => {
  it('merges trip and visit destination ids, skipping missing ones', () => {
    const ids = collectVisitedDestinationIds(
      [{ destination_id: 1 }, {}, { destination_id: 2 }],
      [{ destination_id: 2 }, { destination_id: 3 }, {}],
    )
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 3])
  })
})

describe('filterNewDestinations', () => {
  const recs = [
    { destination: { id: 1, name: 'A' } },
    { destination: { id: 2, name: 'B' } },
    { destination: { id: 3, name: 'C' } },
  ]
  it('drops visited ids and keeps the rest in order', () => {
    expect(filterNewDestinations(recs, new Set([1, 3])).map((r) => r.destination.id)).toEqual([2])
  })
  it('keeps everything when nothing visited', () => {
    expect(filterNewDestinations(recs, new Set())).toHaveLength(3)
  })
})