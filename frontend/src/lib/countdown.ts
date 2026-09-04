export interface Parts {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export function differenceParts(from: Date, to: Date): Parts {
  let diff = Math.max(0, to.getTime() - from.getTime())
  const days = Math.floor(diff / 86_400_000)
  diff -= days * 86_400_000
  const hours = Math.floor(diff / 3_600_000)
  diff -= hours * 3_600_000
  const minutes = Math.floor(diff / 60_000)
  diff -= minutes * 60_000
  const seconds = Math.floor(diff / 1000)
  return { days, hours, minutes, seconds }
}
