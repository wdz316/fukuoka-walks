import { describe, expect, it } from 'vitest'
import { rankResults } from './rankResults'
import type { Recommendation } from './types'

function rec(id: number, name: string, reason = ''): Recommendation {
  return {
    destination: { id, name },
    score: 10,
    reason,
  }
}

const data = [rec(1, 'Beijing'), rec(2, 'Fukuoka'), rec(3, 'Osaka')]

describe('rankResults', () => {
  it('returns ONLY the specified destination when pinned', () => {
    const ranked = rankResults(data, { pinQuery: '福岡', pinnedPrefix: '指定：' })
    expect(ranked.map((r) => r.destination.name)).toEqual(['Fukuoka'])
    expect(ranked[0].reason).toBe('指定：')
  })

  it('returns empty when the pinned destination is absent', () => {
    expect(rankResults(data, { pinQuery: '京都' })).toEqual([])
  })

  it('does not mutate the input array', () => {
    const snapshot = JSON.stringify(data)
    rankResults(data, { pinQuery: '福岡' })
    expect(JSON.stringify(data)).toBe(snapshot)
  })

  it('filters visited only when asked', () => {
    const visited = new Set([1, 3])
    expect(
      rankResults(data, { visitFilter: 'new', visitedIds: visited }).map((r) => r.destination.id),
    ).toEqual([2])
    expect(rankResults(data, { visitFilter: 'any', visitedIds: visited })).toHaveLength(3)
  })
})
