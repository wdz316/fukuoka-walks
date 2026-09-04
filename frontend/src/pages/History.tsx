import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Trip } from '../lib'

export default function HistoryPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    api
      .getTrips()
      .then((data) => setTrips(data))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : '履歴の取得に失敗しました'),
      )
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: number) {
    if (!window.confirm('このプランを削除しますか？')) return
    setDeletingId(id)
    setError(null)
    try {
      await api.deleteTrip(id)
      setTrips((prev) => prev.filter((t) => t.id !== id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  function handleExport(id: number, format: 'markdown' | 'ics') {
    window.open(api.exportTripUrl(id, format), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">履歴</h1>
        <Link
          to="/plan"
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700"
        >
          新しいプランを作成
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-slate-500">読み込み中...</p>
      ) : trips.length === 0 ? (
        <p className="mt-8 text-slate-500">
          履歴はまだありません。プランを作成しましょう。
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {trips.map((trip) => (
            <li key={trip.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{trip.title}</p>
                <p className="text-sm text-slate-500">
                  {trip.start_date} 〜 {trip.end_date}
                </p>
                {trip.notes && (
                  <p className="mt-1 truncate text-sm text-slate-400">{trip.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {trip.destination_id != null && (
                  <Link
                    to={`/destination/${trip.destination_id}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    詳細
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => handleExport(trip.id!, 'markdown')}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  MD出力
                </button>
                <button
                  type="button"
                  onClick={() => handleExport(trip.id!, 'ics')}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  ICS出力
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(trip.id!)}
                  disabled={deletingId === trip.id}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                >
                  {deletingId === trip.id ? '削除中...' : '削除'}
                </button>
                <Link
                  to="/plan"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  再プラン
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
