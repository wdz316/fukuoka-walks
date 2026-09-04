import { describe, expect, it } from 'vitest'
import { differenceParts } from '../lib/countdown'

const d = (s: string) => new Date(s)

describe('differenceParts', () => {
  it('computes days, hours, minutes, seconds', () => {
    const parts = differenceParts(d('2026-09-04T00:00:00Z'), d('2026-09-07T04:05:06Z'))
    expect(parts).toEqual({ days: 3, hours: 4, minutes: 5, seconds: 6 })
  })

  it('clamps to zero when target is in the past', () => {
    const parts = differenceParts(d('2026-09-10T00:00:00Z'), d('2026-09-01T00:00:00Z'))
    expect(parts).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })

  it('clamps to zero at exact equality', () => {
    const t = d('2026-09-04T00:00:00Z')
    expect(differenceParts(t, t)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })

  it('rolls over day boundary into hours', () => {
    const parts = differenceParts(d('2026-09-04T23:00:00Z'), d('2026-09-05T01:30:00Z'))
    expect(parts.days).toBe(0)
    expect(parts.hours).toBe(2)
    expect(parts.minutes).toBe(30)
  })
})
