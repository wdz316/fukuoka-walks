import { useState } from 'react'
import type { FormEvent } from 'react'
import DestinationMap from '../components/DestinationMap'
import {
  api,
  type HolidayType,
  type Recommendation,
  type RecommendRequest,
  type Trip,
} from '../lib'

const HOLIDAY_TYPES: { value: HolidayType; label: string }[] = [
  { value: 'weekend', label: '週末' },
  { value: 'three_day', label: '三連休' },
  { value: 'obon', label: 'お盆' },
  { value: 'golden_week', label: 'ゴールデンウィーク' },
  { value: 'custom', label: '指定なし' },
]

interface FormState {
  startDate: string
  endDate: string
  holidayType: HolidayType
  budget: string
  origin: string
  interests: string
  region: string
  directDestination: string
  directDate: string
}

const emptyForm: FormState = {
  startDate: '',
  endDate: '',
  holidayType: 'custom',
  budget: '',
  origin: '',
  interests: '',
  region: '',
  directDestination: '',
  directDate: '',
}

function today(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function PlanPage() {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [selected, setSelected] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savedTrip, setSavedTrip] = useState<Trip | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function runRecommend(req: RecommendRequest, summary: string) {
    setLoading(true)
    setError(null)
    setMessage(null)
    setSavedTrip(null)
    setSelected(null)
    try {
      const data = await api.recommend(req)
      if (data.length === 0) {
        setRecommendations([])
        setMessage(`「${summary}」に合う旅行先が見つかりませんでした。`)
        return
      }
      setRecommendations(data)
      setSelected(data[0])
      setMessage(`「${summary}」のおすすめが ${data.length} 件見つかりました。`)
    } catch (e: unknown) {
      setRecommendations([])
      setError(e instanceof Error ? e.message : 'レコメンドに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  function buildRequest(): RecommendRequest {
    const interests = form.interests
      .split(/[,、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const budget = form.budget ? Number(form.budget) : undefined
    return {
      start_date: form.startDate,
      end_date: form.endDate,
      holiday_type: form.holidayType,
      origin: form.origin || undefined,
      budget: budget && budget > 0 ? budget : undefined,
      interests: interests.length ? interests : undefined,
      region: form.region || undefined,
    }
  }

  function handleConditionSubmit(e: FormEvent) {
    e.preventDefault()
    void runRecommend(
      buildRequest(),
      [form.startDate, form.endDate, form.holidayType]
        .filter(Boolean)
        .join(' / '),
    )
  }

  async function handleDirectSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    setSavedTrip(null)
    try {
      const data = await api.getDestinations()
      const match = data.find(
        (d) => d.name.toLowerCase() === form.directDestination.toLowerCase(),
      )
      if (!match) {
        setRecommendations([])
        setSelected(null)
        setMessage('指定した旅行先が見つかりませんでした。')
        return
      }
      const rec: Recommendation = {
        destination: match,
        score: 100,
        reason: '指定した旅行先です',
      }
      setRecommendations([rec])
      setSelected(rec)
      setMessage(`「${match.name}」の詳細を表示しています。`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '処理に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const trip: Trip = {
        title: `${selected.destination.name} 旅行プラン`,
        start_date: form.startDate || form.directDate || today(),
        end_date:
          form.endDate || form.directDate || today(),
        destination_id: selected.destination.id,
        notes: selected.reason ?? '',
      }
      const saved = await api.saveTrip(trip)
      setSavedTrip(saved)
      setMessage('プランを保存しました。履歴から確認できます。')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleExport(format: 'markdown' | 'ics') {
    if (!savedTrip?.id) return
    const url = api.exportTripUrl(savedTrip.id, format)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const selectedName = selected?.destination.name ?? ''
  const canSave = selected !== null
  const hasSaved = savedTrip?.id != null

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold text-slate-900">旅行プラン</h1>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">旅行条件から探す</h2>
          <form onSubmit={handleConditionSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="text-slate-600">出発日</span>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => update('startDate', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">帰国日</span>
                <input
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(e) => update('endDate', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-slate-600">休暇の種類</span>
              <select
                value={form.holidayType}
                onChange={(e) =>
                  update('holidayType', e.target.value as HolidayType)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {HOLIDAY_TYPES.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="text-slate-600">予算（現地通貨）</span>
                <input
                  type="number"
                  min={0}
                  value={form.budget}
                  onChange={(e) => update('budget', e.target.value)}
                  placeholder="例: 2000"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">出発地</span>
                <input
                  type="text"
                  value={form.origin}
                  onChange={(e) => update('origin', e.target.value)}
                  placeholder="例: 東京"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-slate-600">興味（カンマ区切り）</span>
              <input
                type="text"
                value={form.interests}
                onChange={(e) => update('interests', e.target.value)}
                placeholder="例: food, nature"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="block text-sm">
              <span className="text-slate-600">地域</span>
              <input
                type="text"
                value={form.region}
                onChange={(e) => update('region', e.target.value)}
                placeholder="例: Asia"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-rose-600 px-4 py-3 font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              {loading ? '検索中...' : 'レコメンドを取得'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            目的地を指定
          </h2>
          <form onSubmit={handleDirectSubmit} className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="text-slate-600">目的地</span>
              <input
                type="text"
                value={form.directDestination}
                onChange={(e) => update('directDestination', e.target.value)}
                placeholder="例: Kyoto"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">出発日</span>
              <input
                type="date"
                value={form.directDate}
                onChange={(e) => update('directDate', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !form.directDestination}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? '処理中...' : 'この目的地でプランを作成'}
            </button>
          </form>
        </section>
      </div>

      {recommendations.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">おすすめの旅行先</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <ul className="space-y-3 lg:col-span-1">
              {recommendations.map((rec) => {
                const active = selected?.destination.id === rec.destination.id
                return (
                  <li key={rec.destination.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(rec)}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        active
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">
                          {rec.destination.name}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          適合 {Math.round(rec.score)}%
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {rec.destination.country}・{rec.destination.region}
                      </p>
                      {rec.reason && (
                        <p className="mt-2 text-sm text-slate-500">{rec.reason}</p>
                      )}
                      {rec.matched_interests &&
                        rec.matched_interests.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {rec.matched_interests.map((m) => (
                              <span
                                key={m}
                                className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="lg:col-span-2">
              {selectedName ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="h-80">
                    <DestinationMap name={selectedName} />
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-bold text-slate-900">
                      {selected!.destination.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {selected!.destination.country}・{selected!.destination.region}
                    </p>
                    {selected!.destination.description && (
                      <p className="mt-3 text-slate-700">
                        {selected!.destination.description}
                      </p>
                    )}
                    {selected!.reason && (
                      <p className="mt-3 text-sm text-slate-600">
                        レコメンド理由：{selected!.reason}
                      </p>
                    )}
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave || saving || hasSaved}
                        className="rounded-lg bg-rose-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                      >
                        {hasSaved ? '保存済み' : saving ? '保存中...' : 'プランを保存'}
                      </button>
                      {hasSaved && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleExport('markdown')}
                            className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            マークダウンで出力
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExport('ics')}
                            className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            ICS（カレンダー）で出力
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-slate-400">
                  旅行先を選択してください
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
