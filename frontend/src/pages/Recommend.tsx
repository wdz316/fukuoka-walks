import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import DestinationMap, { type MapPoint } from '../components/DestinationMap'
import {
  api,
  type Destination,
  type HolidayType,
  type Recommendation,
  type RecommendRequest,
  type Trip,
  type Visit,
} from '../lib'
import { destinationNameMatches, isSameCity } from '../lib/places'
import {
  SAME_CITY_PREF_OPTIONS,
  STAY_LENGTHS,
  WALK_TYPES,
  sameCityDurationDays,
  sameCityHolidayType,
  sameCityInterests,
  type SameCityPref,
  type StayLength,
  type WalkType,
} from '../lib/sameCity'
import { countryLabel, regionLabel, seasonLabel } from '../lib/i18n'
import { displayName } from '../lib/placeNames'
import { buildRoute, mergeCustomPlaces, type CustomPlace } from '../lib/routePlan'
import { useLang } from '../lib/lang'

const HOLIDAY_TYPES: { value: HolidayType; label: string }[] = [
  { value: 'weekend', label: 'holiday.weekend' },
  { value: 'three_day', label: 'holiday.threeDay' },
  { value: 'obon', label: 'holiday.obon' },
  { value: 'golden_week', label: 'holiday.goldenWeek' },
  { value: 'custom', label: 'holiday.custom' },
]

type TripScope = 'near' | 'far'

const SCOPE_OPTIONS: { value: TripScope; label: string; hint: string }[] = [
  { value: 'near', label: 'scope.near', hint: 'scope.nearHint' },
  { value: 'far', label: 'scope.far', hint: 'scope.farHint' },
]

const HOT_DESTINATIONS = ['京都', '大阪', '福岡', '東京', '札幌']
const NEARBY_REGIONS = [
  { value: 'East Asia', label: '東アジア' },
  { value: 'Southeast Asia', label: '東南アジア' },
]
const THEME_INTERESTS = [
  { label: 'theme.food', value: 'food' },
  { label: 'theme.nature', value: 'nature' },
  { label: 'theme.culture', value: 'culture' },
  { label: 'theme.shopping', value: 'shopping' },
]

interface FormState {
  startDate: string
  endDate: string
  holidayType: HolidayType
  budget: string
  origin: string
  destination: string
  interests: string
  region: string
  scope: TripScope
  directDestination: string
  directDate: string
  walkType: WalkType
  sameCityPrefs: SameCityPref[]
  stayDays: StayLength
}

const emptyForm: FormState = {
  startDate: '',
  endDate: '',
  holidayType: 'custom',
  budget: '',
  origin: '',
  destination: '',
  interests: '',
  region: '',
  scope: 'near',
  directDestination: '',
  directDate: '',
  walkType: 'city',
  sameCityPrefs: [],
  stayDays: 'one',
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

function dayCount(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`).getTime()
  const e = new Date(`${end}T00:00:00`).getTime()
  return Math.round((e - s) / 86_400_000) + 1
}

function nextSaturday(): string {
  const now = new Date()
  const daysUntilSat = ((6 - now.getDay() + 7) % 7) || 7
  const sat = new Date(now)
  sat.setDate(now.getDate() + daysUntilSat)
  return toISO(sat)
}

function effectiveDirectDates(form: FormState): {
  start: string
  end: string
  defaultsApplied: boolean
} {
  // No date given: assume a single day (next Saturday). A 2-day weekend
  // default wrongly produced 2日目 + hotels for what users see as a day trip.
  if (form.directDate) return { start: form.directDate, end: form.directDate, defaultsApplied: false }
  const sat = nextSaturday()
  return { start: sat, end: sat, defaultsApplied: true }
}

function estimatedBudget(dest: Destination, days: number): number | null {
  if (!days || days < 1) return null
  let level: number | undefined
  if (days <= 2) level = dest.cost_level_1
  else if (days <= 4) level = dest.cost_level_2
  else if (days <= 7) level = dest.cost_level_3
  else level = dest.cost_level_4
  if (!level || level <= 0) return null
  return level * 20_000 * days
}

function reasonList(reason: string | undefined): string[] {
  if (!reason) return []
  return reason.split(/[。；;\n]/).map((s) => s.trim()).filter(Boolean)
}

/** Merge user-added 自定地点 into the trip notes (name：note, 、-separated). */
function customNoteText(customs: CustomPlace[]): string {
  return customs.map((c) => `${c.name}${c.note ? `：${c.note}` : ''}`).join('、')
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-rose-500 bg-rose-600 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

export default function PlanPage() {
  const { t } = useLang()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [selected, setSelected] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [directLoading, setDirectLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savedTrip, setSavedTrip] = useState<Trip | null>(null)
  const [planDates, setPlanDates] = useState<{ start: string; end: string } | null>(null)
  // Panel tab: 'auto' follows same-city detection, manual picks stick until
  // 出発地/目的地 are edited again.
  const [modeTab, setModeTab] = useState<'auto' | 'normal' | 'city'>('auto')
  // 足迹 (check-in) state: visited spots for the selected destination, plus
  // user-added 自定地点 which only live on the current route (notes on save).
  const [visits, setVisits] = useState<Visit[]>([])
  const [customPlaces, setCustomPlaces] = useState<CustomPlace[]>([])
  const [customName, setCustomName] = useState('')
  const [customNote, setCustomNote] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const [visitError, setVisitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .getVisits()
      .then((list) => {
        if (!cancelled) setVisits(list)
      })
      .catch(() => {
        if (!cancelled) setVisits([])
      })
    return () => {
      cancelled = true
    }
  }, [selected?.destination.id])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function togglePref(pref: SameCityPref) {
    setForm((prev) => ({
      ...prev,
      sameCityPrefs: prev.sameCityPrefs.includes(pref)
        ? prev.sameCityPrefs.filter((p) => p !== pref)
        : [...prev.sameCityPrefs, pref],
    }))
  }

  const sameCity = useMemo(
    () =>
      form.origin.trim().length > 0 &&
      form.destination.trim().length > 0 &&
      isSameCity(form.origin, form.destination),
    [form.origin, form.destination],
  )

  const cityMode = modeTab === 'auto' ? sameCity : modeTab === 'city'

  function updatePlace(key: 'origin' | 'destination', value: string) {
    const next = { ...form, [key]: value }
    setForm(next)
    // Auto-switch TO city mode only when both fields match. Never yank the
    // user away mid-typing: manual tab picks stick until a real match appears.
    if (
      next.origin.trim().length > 0 &&
      next.destination.trim().length > 0 &&
      isSameCity(next.origin, next.destination)
    ) {
      setModeTab('auto')
    }
  }

  async function runRecommend(req: RecommendRequest, summary: string, pinQuery?: string) {
    setLoading(true)
    setError(null)
    setMessage(null)
    setSavedTrip(null)
    setSelected(null)
    setRecommendations([])
    setPlanDates({ start: req.start_date, end: req.end_date || req.start_date })
    try {
      const data = await api.recommend(req)
      if (data.length === 0) {
        setRecommendations([])
        setMessage(t('plan.msgNoMatch', { summary }))
        return
      }
      // Pin an explicitly requested destination to the top so the condition
      // search honors the 目的地 field instead of burying it.
      let ranked = data
      if (pinQuery) {
        const idx = data.findIndex((r) => destinationNameMatches(r.destination.name, pinQuery))
        if (idx > 0) {
          const [pinned] = data.splice(idx, 1)
          pinned.reason = `${t('plan.pinnedPrefix')}${pinned.reason ?? ''}`
          ranked = [pinned, ...data]
        } else if (idx === 0) {
          data[0].reason = `${t('plan.pinnedPrefix')}${data[0].reason ?? ''}`
        }
      }
      setRecommendations(ranked)
      setSelected(ranked[0])
      setMessage(t('plan.msgFound', { summary, n: ranked.length }))
    } catch (e: unknown) {
      setRecommendations([])
      setError(e instanceof Error ? e.message : t('plan.failRecommend'))
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
      // 長途 ignores the region limit so long-haul destinations are included;
      // 近郊 keeps the user's region (short trips already bias nearby).
      region: form.scope === 'far' ? undefined : form.region || undefined,
    }
  }

  function toggleThemeInterest(value: string) {
    setForm((prev) => {
      const cur = prev.interests
        .split(/[,、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value]
      return { ...prev, interests: next.join(', ') }
    })
  }

  async function runSameCitySearch() {
    const start = form.startDate
    if (!start) {
      setMessage(t('plan.msgSelectStartDate'))
      return
    }
    const days = sameCityDurationDays(form.stayDays)
    const end = days > 0 ? addDays(start, days) : start
    const req: RecommendRequest = {
      start_date: start,
      end_date: end,
      origin: form.origin.trim(),
      interests: sameCityInterests(form.walkType, form.sameCityPrefs),
      holiday_type: sameCityHolidayType(form.walkType),
    }
    await runRecommend(req, t('plan.sameCitySummary', { origin: form.origin.trim() }))
  }

  function handleConditionSubmit(e: FormEvent) {
    e.preventDefault()
    if (cityMode) {
      void runSameCitySearch()
      return
    }
    const req = buildRequest()
    const scopeLabel = t(form.scope === 'far' ? 'scope.far' : 'scope.near')
    const parts = [form.startDate, form.endDate, scopeLabel, form.holidayType].filter(Boolean)
    if (form.scope === 'far' && form.startDate && form.endDate) {
      if (dayCount(form.startDate, form.endDate) < 3) {
        parts.push(t('plan.recommend3plus'))
      }
    }
    void runRecommend(req, parts.join(' / '), cityMode ? undefined : form.destination.trim() || undefined)
  }

  async function handleDirectSubmit(e: FormEvent) {
    e.preventDefault()
    const query = form.directDestination.trim()
    if (!query) {
      setMessage(t('plan.msgEnterDestination'))
      return
    }
    setDirectLoading(true)
    setError(null)
    setMessage(null)
    setSavedTrip(null)
    setRecommendations([])
    setSelected(null)
    setPlanDates(null)
    try {
      const data = await api.getDestinations()
      const match = data.find((d) => destinationNameMatches(d.name, query))
      if (!match) {
        setMessage(t('plan.msgDestinationNotFound', { query }))
        return
      }
      const rec: Recommendation = {
        destination: match,
        score: 100,
        reason: t('plan.specifiedDestination'),
      }
      setRecommendations([rec])
      setSelected(rec)
      const plan = effectiveDirectDates(form)
      setPlanDates(plan)
      setMessage(
        plan.defaultsApplied
          ? t('plan.msgDirectWithDefault', {
              name: displayName(match.name),
              start: plan.start,
            })
          : t('plan.msgDirect', { name: displayName(match.name) }),
      )
    } catch (err: unknown) {
      setRecommendations([])
      setSelected(null)
      setError(err instanceof Error ? err.message : t('error.processFailed'))
    } finally {
      setDirectLoading(false)
    }
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const plan = planDates ?? (form.startDate
        ? { start: form.startDate, end: form.endDate || form.startDate }
        : effectiveDirectDates(form))
      const trip: Trip = {
        title: t('plan.tripTitle', { name: displayName(selected.destination.name) }),
        start_date: plan.start,
        end_date: plan.end,
        destination_id: selected.destination.id,
        notes: [selected.reason ?? '', customNoteText(customPlaces)].filter(Boolean).join('\n'),
      }
      const saved = await api.saveTrip(trip)
      setSavedTrip(saved)
      setMessage(t('plan.msgSaved'))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('plan.failSave'))
    } finally {
      setSaving(false)
    }
  }

  async function handleExport(format: 'markdown' | 'ics') {
    if (!savedTrip?.id) return
    const url = api.exportTripUrl(savedTrip.id, format)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleAddCustom(e: FormEvent) {
    e.preventDefault()
    const name = customName.trim()
    if (!name) {
      setVisitError(t('visit.emptyCustom'))
      return
    }
    const note = customNote.trim()
    setCustomPlaces((prev) => [...prev, { name, note: note || undefined }])
    setCustomName('')
    setCustomNote('')
    setVisitError(null)
    setMessage(t('visit.customAdded', { name }))
  }

  async function handleComplete() {
    if (!savedTrip?.id) return
    const names = mergedRoute
      .flatMap((d) => d.stops.map((s) => s.name))
      .filter((n, i, arr) => arr.indexOf(n) === i)
    setCheckingIn(true)
    setVisitError(null)
    try {
      const updated = await api.completeTrip(savedTrip.id, names)
      setSavedTrip({ ...savedTrip, ...updated })
      const fresh = await api.getVisits()
      setVisits(fresh)
      setMessage(t('visit.completedMsg', { n: names.length }))
    } catch (err: unknown) {
      setVisitError(err instanceof Error ? err.message : t('visit.completeFail'))
    } finally {
      setCheckingIn(false)
    }
  }

  const selectedName = selected?.destination.name ?? ''
  const canSave = selected !== null
  const hasSaved = savedTrip?.id != null

  const selectedDest = selected?.destination
  const days = planDates ? dayCount(planDates.start, planDates.end) : 0
  const budget = selectedDest && days ? estimatedBudget(selectedDest, days) : null
  const reasons = reasonList(selected?.reason)
  const matchedInterests = selected?.matched_interests ?? []
  const route = selectedDest
    ? buildRoute(selectedDest.attractions, selectedDest.hotels, {
        days: days > 0 ? days : undefined,
        // Day trips never show overnight stays.
        includeHotels: days === 0 || days >= 2,
      })
    : []
  const mergedRoute = mergeCustomPlaces(route, customPlaces)
  const visitedNames = useMemo(
    () => new Set(visits.map((v) => v.attraction_name)),
    [visits],
  )
  const mapPoints: MapPoint[] = useMemo(() => {
    if (!selectedDest) return []
    const spots = [...(selectedDest.attractions ?? []), ...(selectedDest.hotels ?? [])]
    return spots
      .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
      .map((p) => ({
        name: p.name,
        lat: p.lat as number,
        lng: p.lng as number,
        visited: visitedNames.has(p.name),
      }))
  }, [selectedDest, visitedNames])
  const tripCompleted = savedTrip?.status === 'completed'

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold text-slate-900">{t('plan.title')}</h1>

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
          <h2 className="text-lg font-semibold text-slate-900">{t('plan.searchByConditions')}</h2>
          <form onSubmit={handleConditionSubmit} className="mt-4 space-y-4">
            <div>
              <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setModeTab('normal')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    !cityMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {t('plan.normalSearch')}
                </button>
                <button
                  type="button"
                  onClick={() => setModeTab('city')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    cityMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {t('plan.sameCityPlan')}
                </button>
              </div>
            </div>

            {cityMode ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm">
                    <span className="text-slate-600">{t('plan.origin')}</span>
                    <input
                      type="text"
                      value={form.origin}
                      onChange={(e) => updatePlace('origin', e.target.value)}
                      placeholder="例: 福岡"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">{t('plan.destination')}</span>
                    <input
                      type="text"
                      value={form.destination}
                      onChange={(e) => updatePlace('destination', e.target.value)}
                      placeholder="例: 福岡"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                </div>

                <label className="block text-sm">
                  <span className="text-slate-600">{t('plan.startDate')}</span>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => update('startDate', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>

                {sameCity ? (
                  <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                    {t('plan.sameCityMode', { origin: form.origin, destination: form.destination })}
                  </div>
                ) : (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                    {t('plan.sameCityHint')}
                  </div>
                )}

                <div>
                  <span className="text-sm text-slate-600">{t('plan.howToSpend')}</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WALK_TYPES.map((w) => (
                      <Chip
                        key={w.value}
                        active={form.walkType === w.value}
                        onClick={() => update('walkType', w.value)}
                      >
                        {t(w.label)}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-slate-600">{t('plan.preferences')}</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SAME_CITY_PREF_OPTIONS.map((p) => (
                      <Chip
                        key={p.value}
                        active={form.sameCityPrefs.includes(p.value)}
                        onClick={() => togglePref(p.value)}
                      >
                        {t(p.label)}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-slate-600">{t('plan.stayDuration')}</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {STAY_LENGTHS.map((s) => (
                      <Chip
                        key={s.value}
                        active={form.stayDays === s.value}
                        onClick={() => update('stayDays', s.value)}
                      >
                        {t(s.label)}
                      </Chip>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-rose-600 px-4 py-3 font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                >
                  {loading ? t('plan.searching') : t('plan.searchSameCity')}
                </button>
              </>
            ) : (
              <>
                <div>
                  <span className="text-sm text-slate-600">
                    {t('plan.tripScope')} <span className="ml-1 text-xs text-slate-400">{t('plan.freeTravel')}</span>
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SCOPE_OPTIONS.map((s) => (
                      <Chip
                        key={s.value}
                        active={form.scope === s.value}
                        onClick={() => update('scope', s.value)}
                      >
                        {t(s.label)}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {t(SCOPE_OPTIONS.find((s) => s.value === form.scope)?.hint ?? '')}
                    {form.scope === 'far' ? t('plan.regionUnlimited') : ''}
                  </p>
                </div>

                <div>
                  <span className="text-sm text-slate-600">{t('plan.popularDestinations')}</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {HOT_DESTINATIONS.map((name) => (
                      <Chip
                        key={name}
                        active={form.destination === name}
                        onClick={() =>
                          updatePlace('destination', form.destination === name ? '' : name)
                        }
                      >
                        {name}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm">
                    <span className="text-slate-600">{t('plan.startDate')}</span>
                    <input
                      type="date"
                      required
                      value={form.startDate}
                      onChange={(e) => update('startDate', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">{t('plan.endDate')}</span>
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
                  <span className="text-slate-600">{t('plan.holidayType')}</span>
                  <select
                    value={form.holidayType}
                    onChange={(e) =>
                      update('holidayType', e.target.value as HolidayType)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    {HOLIDAY_TYPES.map((h) => (
                      <option key={h.value} value={h.value}>
                        {t(h.label)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm">
                    <span className="text-slate-600">{t('plan.origin')}</span>
                    <input
                      type="text"
                      value={form.origin}
                      onChange={(e) => updatePlace('origin', e.target.value)}
                      placeholder="例: 東京"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">{t('plan.destination')}</span>
                    <input
                      type="text"
                      value={form.destination}
                      onChange={(e) => updatePlace('destination', e.target.value)}
                      placeholder="例: 福岡（出発地と同じなら同都市モード）"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                </div>

                <label className="block text-sm">
                  <span className="text-slate-600">{t('plan.budget')}</span>
                  <input
                    type="number"
                    min={0}
                    value={form.budget}
                    onChange={(e) => update('budget', e.target.value)}
                    placeholder="例: 300000"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="block text-sm">
                  <span className="text-slate-600">{t('plan.interests')}</span>
                  <input
                    type="text"
                    value={form.interests}
                    onChange={(e) => update('interests', e.target.value)}
                    placeholder="例: food, nature"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="block text-sm">
                  <span className="text-slate-600">{t('plan.region')}</span>
                  <input
                    type="text"
                    value={form.region}
                    onChange={(e) => update('region', e.target.value)}
                    placeholder="例: East Asia"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>

                <div>
                  <span className="text-sm text-slate-600">{t('plan.nearbyTheme')}</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {NEARBY_REGIONS.map((r) => (
                      <Chip
                        key={r.value}
                        active={form.region === r.value}
                        onClick={() =>
                          update('region', form.region === r.value ? '' : r.value)
                        }
                      >
                        {t('plan.nearbyPrefix')}{r.label}
                      </Chip>
                    ))}
                    {THEME_INTERESTS.map((ti) => {
                      const cur = form.interests
                        .split(/[,、\s]+/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                      return (
                        <Chip
                          key={ti.value}
                          active={cur.includes(ti.value)}
                          onClick={() => toggleThemeInterest(ti.value)}
                        >
                          {t(ti.label)}
                        </Chip>
                      )
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-rose-600 px-4 py-3 font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                >
                  {loading ? t('plan.searching') : t('plan.getRecommendations')}
                </button>
              </>
            )}
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('plan.specifyDestination')}
          </h2>
          <form onSubmit={handleDirectSubmit} className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="text-slate-600">{t('plan.destination')}</span>
              <input
                type="text"
                value={form.directDestination}
                onChange={(e) => update('directDestination', e.target.value)}
                placeholder="例: 京都, Fukuoka"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">{t('plan.startDate')}</span>
              <input
                type="date"
                value={form.directDate}
                onChange={(e) => update('directDate', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={directLoading || !form.directDestination}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {directLoading ? t('plan.processing') : t('plan.createWithDestination')}
            </button>
          </form>
        </section>
      </div>

      {recommendations.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">{t('plan.recommendedDestinations')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <ul className="space-y-3 lg:col-span-1">
              {recommendations.map((rec) => {
                const active = selected?.destination.id === rec.destination.id
                return (
                  <li key={rec.destination.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(rec)
                        setSavedTrip(null)
                      }}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        active
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">
                          {displayName(rec.destination.name)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                           {t('plan.fitScore', { score: Math.round(rec.score) })}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {countryLabel(rec.destination.country)}・{regionLabel(rec.destination.region)}
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
              {selectedDest ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {selectedDest.image_url ? (
                    <img
                      src={selectedDest.image_url}
                      alt={selectedDest.name}
                      className="h-56 w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="h-56">
                      <DestinationMap name={selectedName} />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xl font-bold text-slate-900">
                        {displayName(selectedDest.name)}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {t('plan.fitScore', { score: Math.round(selected!.score) })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {countryLabel(selectedDest.country)}・{regionLabel(selectedDest.region)}
                      {selectedDest.best_season && (
                        <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {t('plan.bestSeason', { season: seasonLabel(selectedDest.best_season) })}
                        </span>
                      )}
                    </p>
                    {selectedDest.description && (
                      <p className="mt-3 text-slate-700">{selectedDest.description}</p>
                    )}

                    {selectedDest.tags && selectedDest.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {selectedDest.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {(reasons.length > 0 || matchedInterests.length > 0) && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-slate-500">
                          {t('plan.recommendReason')}
                        </h4>
                        {reasons.length > 0 && (
                          <ul className="mt-2 space-y-1 text-sm text-slate-600">
                            {reasons.map((r, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-rose-500">・</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {matchedInterests.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {matchedInterests.map((m) => (
                              <span
                                key={m}
                                className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {planDates && (
                      <p className="mt-4 text-sm text-slate-600">
                        {t('plan.schedule', {
                          start: planDates.start,
                          end: planDates.end,
                          days,
                        })}
                      </p>
                    )}

                    {budget != null && (
                      <p className="mt-1 text-sm text-slate-600">
                        {t('plan.budgetEstimate', {
                          amount: budget.toLocaleString('ja-JP'),
                        })}
                      </p>
                    )}

                    {mergedRoute.length > 0 && (
                      <div className="mt-5">
                        <h4 className="text-sm font-semibold text-slate-500">
                          {t('plan.modelRoute')}
                        </h4>
                        <div className="mt-2 space-y-3">
                          {mergedRoute.map((d, di) => (
                            <div key={di} className="rounded-lg border border-slate-200 p-3">
                              <p className="text-sm font-semibold text-rose-600">
                                {d.day != null
                                  ? t('plan.dayX', { day: d.day })
                                  : d.isCustom
                                    ? t('visit.customPlaces')
                                    : t('plan.commonSchedule')}
                              </p>
                              <ul className="mt-2 space-y-2">
                                {d.stops.map((s, si) => (
                                  <li key={si} className="flex gap-2 text-sm">
                                    <span className="w-10 flex-none rounded bg-slate-100 px-1 py-0.5 text-center text-xs text-slate-600">
                                      {s.kind === 'custom' ? t('visit.customStop') : s.timeLabel}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-800">
                                        {s.kind === 'hotel' ? '🏨 ' : s.kind === 'custom' ? '✚ ' : '📍 '}
                                        {s.url ? (
                                          <a
                                            href={s.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-rose-600 hover:text-rose-700"
                                          >
                                            {s.name}
                                          </a>
                                        ) : (
                                          s.name
                                        )}
                                      </p>
                                      {s.kind === 'custom' ? (
                                        s.note ? (
                                          <p className="text-xs text-slate-500">{s.note}</p>
                                        ) : null
                                      ) : (
                                        <p className="text-xs text-slate-500">
                                          {t('plan.transport', { transport: s.transport })}
                                          {s.booking_url && (
                                            <>
                                              {' ・ '}
                                              <a
                                                href={s.booking_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="font-medium text-rose-600 hover:text-rose-700"
                                              >
                                                {t('plan.book')}
                                              </a>
                                            </>
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                              {d.extras.length > 0 && (
                                <div className="mt-2 rounded-lg bg-slate-50 p-2">
                                  <p className="text-xs font-medium text-slate-500">
                                    {t('plan.ifTimeVisit')}
                                  </p>
                                  <ul className="mt-1 space-y-1">
                                    {d.extras.map((s, si) => (
                                      <li key={si} className="text-xs text-slate-600">
                                        ・{s.url ? (
                                          <a
                                            href={s.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-rose-600 hover:text-rose-700"
                                          >
                                            {s.name}
                                          </a>
                                        ) : (
                                          s.name
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleComplete}
                            disabled={!hasSaved || checkingIn || tripCompleted}
                            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                          >
                            {tripCompleted
                              ? t('visit.completed')
                              : checkingIn
                                ? t('visit.completing')
                                : t('visit.completeCheckin')}
                          </button>
                          {!hasSaved && (
                            <span className="text-xs text-slate-500">{t('visit.saveFirst')}</span>
                          )}
                          {visitError && <span className="text-xs text-rose-600">{visitError}</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{t('visit.checkinHint')}</p>

                        <form onSubmit={handleAddCustom} className="mt-3 flex flex-wrap items-end gap-2">
                          <label className="flex flex-col text-sm">
                            <span className="text-xs text-slate-500">{t('visit.placeName')}</span>
                            <input
                              type="text"
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              placeholder="例: もつ鍋 やまや"
                              className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="flex flex-col text-sm">
                            <span className="text-xs text-slate-500">{t('visit.note')}</span>
                            <input
                              type="text"
                              value={customNote}
                              onChange={(e) => setCustomNote(e.target.value)}
                              className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            {t('visit.addToRoute')}
                          </button>
                        </form>

                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-slate-500">{t('visit.trailMap')}</h4>
                          <div className="mt-2 h-72 overflow-hidden rounded-xl border border-slate-200">
                            <DestinationMap name={selectedName} points={mapPoints} />
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedDest.attractions &&
                      selectedDest.attractions.length > 0 && (
                        <div className="mt-5">
                          <h4 className="text-sm font-semibold text-slate-500">
                            {t('plan.sights')}
                          </h4>
                          <ul className="mt-2 space-y-2">
                            {selectedDest.attractions.map((a, i) => (
                              <li
                                key={i}
                                className="rounded-lg border border-slate-200 p-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-slate-800">{a.name}</p>
                                  {typeof a.day === 'number' && (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                      {t('plan.dayX', { day: a.day })}
                                    </span>
                                  )}
                                </div>
                                {a.address && (
                                  <p className="mt-1 text-xs text-slate-500">{a.address}</p>
                                )}
                                {a.phone && (
                                  <p className="text-xs text-slate-500">TEL: {a.phone}</p>
                                )}
                                {(a.url || a.booking_url) && (
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                    {a.url && (
                                      <a
                                        href={a.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-rose-600 hover:text-rose-700"
                                      >
                                        {t('plan.officialSite')}
                                      </a>
                                    )}
                                    {a.booking_url && (
                                      <a
                                        href={a.booking_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-rose-600 hover:text-rose-700"
                                      >
                                        {t('plan.book')}
                                      </a>
                                    )}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {selectedDest.hotels && selectedDest.hotels.length > 0 && (
                      <div className="mt-5">
                        <h4 className="text-sm font-semibold text-slate-500">
                          {t('plan.hotels')}
                        </h4>
                        <ul className="mt-2 space-y-2">
                          {selectedDest.hotels.map((h, i) => (
                            <li
                              key={i}
                              className="rounded-lg border border-slate-200 p-3"
                            >
                              <p className="font-medium text-slate-800">{h.name}</p>
                              {h.address && (
                                <p className="mt-1 text-xs text-slate-500">{h.address}</p>
                              )}
                              {h.phone && (
                                <p className="text-xs text-slate-500">TEL: {h.phone}</p>
                              )}
                              {(h.url || h.booking_url) && (
                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                  {h.url && (
                                    <a
                                      href={h.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-medium text-rose-600 hover:text-rose-700"
                                    >
                                      {t('plan.officialSite')}
                                    </a>
                                  )}
                                  {h.booking_url && (
                                    <a
                                      href={h.booking_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-medium text-rose-600 hover:text-rose-700"
                                    >
                                      {t('plan.book')}
                                    </a>
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave || saving || hasSaved}
                        className="rounded-lg bg-rose-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                      >
                        {hasSaved ? t('plan.saved') : saving ? t('plan.saving') : t('plan.savePlan')}
                      </button>
                      {hasSaved && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleExport('markdown')}
                            className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            {t('plan.exportMarkdown')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExport('ics')}
                            className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            {t('plan.exportIcs')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-slate-400">
                  {t('plan.selectDestination')}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}