import { describe, expect, it } from 'vitest'
import { dictKeys, dicts, translate, type Lang } from './lang'

describe('lang dictionary', () => {
  it('has the same keys in both languages', () => {
    expect(dictKeys(dicts.zh)).toEqual(dictKeys(dicts.ja))
  })

  it('has no empty values in either language', () => {
    for (const lang of ['zh', 'ja'] as Lang[]) {
      const entries = Object.entries(dicts[lang])
      for (const [key, value] of entries) {
        expect(value.trim().length, `${lang}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('defaults Chinese translations to simplified characters', () => {
    expect(translate('zh', 'nav.plan')).toBe('旅行计划')
    expect(translate('zh', 'plan.origin')).toBe('出发地')
    expect(translate('zh', 'plan.destination')).toBe('目的地')
    expect(translate('zh', 'plan.startDate')).toBe('出发日')
    expect(translate('zh', 'plan.endDate')).toBe('结束日')
    expect(translate('zh', 'scope.near')).toBe('近郊')
    expect(translate('zh', 'scope.far')).toBe('长途')
    expect(translate('zh', 'walk.city')).toBe('市内漫步')
    expect(translate('zh', 'plan.recommendReason')).toBe('推荐理由')
    expect(translate('zh', 'plan.savePlan')).toBe('保存计划')
  })

  it('keeps existing Japanese copy', () => {
    expect(translate('ja', 'nav.plan')).toBe('旅行計画')
    expect(translate('ja', 'plan.origin')).toBe('出発地')
    expect(translate('ja', 'plan.recommendReason')).toBe('レコメンド理由')
  })

  it('substitutes positional parameters', () => {
    expect(translate('zh', 'plan.fitScore', { score: 87 })).toBe('适合度 87%')
    expect(translate('ja', 'plan.fitScore', { score: 87 })).toBe('適合 87%')
    expect(translate('zh', 'dash.totalHistory', { n: 3, m: 1 })).toBe(
      '共 3 条历史记录（已完成 1 条）',
    )
  })

  it('falls back to the key when missing', () => {
    expect(translate('zh', 'missing.key')).toBe('missing.key')
  })

  it('translates 自建地点 spot keys in both languages', () => {
    expect(translate('zh', 'spot.customSpot')).toBe('自建地点')
    expect(translate('ja', 'spot.customSpot')).toBe('カスタムスポット')
    expect(translate('zh', 'spot.addSpot')).toBe('添加地点')
    expect(translate('ja', 'spot.uploadFailed')).toBe(
      '写真のアップロードに失敗しました。テキスト情報を保存しました',
    )
  })
})
