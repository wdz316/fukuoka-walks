import { describe, expect, it } from 'vitest'
import {
  sameCityDurationDays,
  sameCityHolidayType,
  sameCityInterests,
} from './sameCity'

describe('sameCityInterests', () => {
  it('maps walk types to base interests', () => {
    expect(sameCityInterests('city', [])).toEqual(['city'])
    expect(sameCityInterests('suburban', [])).toEqual(['nature'])
    expect(sameCityInterests('stay', [])).toEqual(['nature'])
  })

  it('appends preference interests in order', () => {
    expect(sameCityInterests('city', ['food', 'culture'])).toEqual([
      'city',
      'food',
      'culture',
    ])
  })

  it('deduplicates overlap between walk type and prefs', () => {
    expect(sameCityInterests('suburban', ['nature'])).toEqual(['nature'])
  })
})

describe('sameCityHolidayType', () => {
  it('treats overnight stays as weekend', () => {
    expect(sameCityHolidayType('stay')).toBe('weekend')
    expect(sameCityHolidayType('city')).toBe('custom')
    expect(sameCityHolidayType('suburban')).toBe('custom')
  })
})

describe('sameCityDurationDays', () => {
  it('maps stay lengths to additional days', () => {
    expect(sameCityDurationDays('half')).toBe(0)
    expect(sameCityDurationDays('one')).toBe(0)
    expect(sameCityDurationDays('two')).toBe(1)
  })
})