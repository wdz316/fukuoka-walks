import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Countdown from '../components/Countdown'
import { api, type Trip } from '../lib'

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .getTrips()
      .then((data) => {
        if (!active) return
        setTrips(data)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : '履歴の取得に失敗しました')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const now = new Date()
  const upcoming = [...trips]
    .filter((t) => t.start_date && new Date(t.start_date).getTime() >= now.getTime())
    .sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
    )
  const next = upcoming[0] ?? null
  const recent = [...trips]
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    )
    .slice(0, 5)
  const past = trips.filter(
    (t) => t.start_date && new Date(t.start_date).getTime() < now.getTime(),
  ).length

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold text-slate-900">ホーム</h1>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-slate-500">読み込み中...</p>
        ) : next ? (
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm text-slate-500">次の旅行「{next.title}」まで</p>
              <div className="mt-3">
                <Countdown startDate={next.start_date} />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {next.start_date} 〜 {next.end_date}
              </p>
            </div>
            <Link
              to="/history"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              プランを確認
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-slate-600">予定している旅行はありません。</p>
            <Link
              to="/plan"
              className="mt-4 inline-block rounded-lg bg-rose-600 px-6 py-3 font-medium text-white transition-colors hover:bg-rose-700"
            >
              どこへ行きたいか分からない → レコメンド
            </Link>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">最近の履歴</h2>
        {loading ? (
          <p className="mt-4 text-slate-500">読み込み中...</p>
        ) : recent.length === 0 ? (
          <p className="mt-4 text-slate-500">まだ履歴がありません。</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {recent.map((trip) => (
              <li key={trip.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-slate-900">{trip.title}</p>
                  <p className="text-sm text-slate-500">
                    {trip.start_date} 〜 {trip.end_date}
                  </p>
                </div>
                <Link
                  to="/history"
                  className="text-sm font-medium text-rose-600 hover:text-rose-700"
                >
                  表示
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!loading && past > 0 && (
        <p className="mt-6 text-sm text-slate-400">
          合計 {trips.length} 件の履歴（完了 {past} 件）
        </p>
      )}
    </div>
  )
}
