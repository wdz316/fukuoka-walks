import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DestinationMap from '../components/DestinationMap'
import { api, type Destination } from '../lib'
import { countryLabel, regionLabel } from '../lib/i18n'

export default function DestinationPage() {
  const { id } = useParams<{ id: string }>()
  const destinationId = Number(id)
  const [destination, setDestination] = useState<Destination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(destinationId)) return
    let active = true
    api
      .getDestinations()
      .then((data) => {
        if (!active) return
        const found = data.find((d) => d.id === destinationId)
        if (!found) {
          setError('旅行先が見つかりませんでした')
        } else {
          setDestination(found)
        }
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : '旅行先の取得に失敗しました')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [destinationId])

  const seasonLabels: Record<string, string> = {
    spring: '春',
    summer: '夏',
    autumn: '秋',
    winter: '冬',
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        to="/history"
        className="text-sm font-medium text-rose-600 hover:text-rose-700"
      >
        ← 履歴に戻る
      </Link>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {Number.isFinite(destinationId) && loading ? (
        <p className="mt-8 text-slate-500">読み込み中...</p>
      ) : !destination ? null : (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h1 className="text-3xl font-bold text-slate-900">
                {destination.name}
              </h1>
              <p className="mt-2 text-slate-500">
                {countryLabel(destination.country)}・{regionLabel(destination.region)}
              </p>
              {destination.best_season && (
                <p className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  おすすめシーズン：{seasonLabels[destination.best_season]}
                </p>
              )}
              {destination.description && (
                <p className="mt-4 text-slate-700">{destination.description}</p>
              )}
              {destination.tags && destination.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {destination.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {destination.image_url && (
                <img
                  src={destination.image_url}
                  alt={destination.name}
                  className="mt-5 w-full rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/plan"
                  className="rounded-lg bg-rose-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-rose-700"
                >
                  この旅行先でプランを作成
                </Link>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-[28rem]">
                <DestinationMap name={destination.name} />
              </div>
            </section>
          </div>
      )}
    </div>
  )
}
