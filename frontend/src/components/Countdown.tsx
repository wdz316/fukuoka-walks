import { useEffect, useMemo, useState } from 'react'
import { differenceParts } from '../lib/countdown'

interface CountdownProps {
  startDate: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export default function Countdown({ startDate }: CountdownProps) {
  const target = useMemo(() => new Date(`${startDate}T00:00:00`), [startDate])
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const parts = differenceParts(now, target)
  const started = now.getTime() >= target.getTime()

  return (
    <div className="flex items-center gap-4">
      {started ? (
        <span className="text-sm font-medium text-slate-600">出発日です！</span>
      ) : (
        <>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-slate-900">
              {pad(parts.days)}
            </span>
            <span className="text-xs text-slate-500">日</span>
          </div>
          <span className="text-2xl font-bold text-slate-400">:</span>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-slate-900">
              {pad(parts.hours)}
            </span>
            <span className="text-xs text-slate-500">時間</span>
          </div>
          <span className="text-2xl font-bold text-slate-400">:</span>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-slate-900">
              {pad(parts.minutes)}
            </span>
            <span className="text-xs text-slate-500">分</span>
          </div>
          <span className="text-2xl font-bold text-slate-400">:</span>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-slate-900">
              {pad(parts.seconds)}
            </span>
            <span className="text-xs text-slate-500">秒</span>
          </div>
        </>
      )}
    </div>
  )
}
