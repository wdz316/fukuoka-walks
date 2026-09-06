import { describe, expect, it } from 'vitest'
import { displayName } from './placeNames'

describe('displayName', () => {
  it('maps catalogue English names to Japanese', () => {
    expect(displayName('Fukuoka')).toBe('福岡')
    expect(displayName('Beijing')).toBe('北京')
    expect(displayName('Kyoto')).toBe('京都')
    expect(displayName('New York City')).toBe('ニューヨーク')
  })

  it('falls back to the raw name and empty string', () => {
    expect(displayName('Atlantis')).toBe('Atlantis')
    expect(displayName(null)).toBe('')
    expect(displayName(undefined)).toBe('')
  })
})
