import { describe, expect, it } from 'vitest'
import { ORIGIN_PRESETS, originPreset } from './origins'

describe('origins', () => {
  it('falls back to Hakata station for unknown values', () => {
    expect(originPreset('nope').value).toBe('hakata')
    expect(originPreset(null).value).toBe('hakata')
  })

  it('has valid Fukuoka coordinates and unique values', () => {
    const values = ORIGIN_PRESETS.map((o) => o.value)
    expect(new Set(values).size).toBe(values.length)
    for (const o of ORIGIN_PRESETS) {
      expect(o.lat).toBeGreaterThan(33)
      expect(o.lat).toBeLessThan(34)
      expect(o.lng).toBeGreaterThan(130)
      expect(o.lng).toBeLessThan(131)
    }
  })
})
