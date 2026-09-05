import { describe, expect, it } from 'vitest'
import { countryLabel, regionLabel } from './i18n'

describe('countryLabel', () => {
  it('maps English country names to Japanese', () => {
    expect(countryLabel('Japan')).toBe('日本')
    expect(countryLabel('South Korea')).toBe('韓国')
    expect(countryLabel('France')).toBe('フランス')
  })

  it('maps Chinese country names to Japanese', () => {
    expect(countryLabel('日本')).toBe('日本')
    expect(countryLabel('韩国')).toBe('韓国')
    expect(countryLabel('美国')).toBe('アメリカ')
  })

  it('falls back to the raw value', () => {
    expect(countryLabel('Atlantis')).toBe('Atlantis')
    expect(countryLabel(null)).toBe('')
  })
})

describe('regionLabel', () => {
  it('maps English region names to Japanese', () => {
    expect(regionLabel('East Asia')).toBe('東アジア')
    expect(regionLabel('Europe')).toBe('ヨーロッパ')
    expect(regionLabel('Oceania')).toBe('オセアニア')
  })

  it('fixes mixed Chinese/Japanese labels', () => {
    expect(regionLabel('东亚')).toBe('東アジア')
    expect(regionLabel('东南亚')).toBe('東南アジア')
  })

  it('falls back to the raw value', () => {
    expect(regionLabel('Somewhere')).toBe('Somewhere')
    expect(regionLabel(undefined)).toBe('')
  })
})