import { Event } from '@/types/models'
import { startOfDay } from '@/lib/utils'

export interface DailyStats {
  date: string
  feedingCount: number
  sleepTotalMinutes: number
  diaperCount: number
}

export function aggregateDailyStats(events: Event[]): DailyStats[] {
  const statsMap = new Map<string, DailyStats>()

  events.forEach((event) => {
    const eventDate = new Date(event.event_time)
    const dayStart = startOfDay(eventDate)
    const dateKey = dayStart.toISOString().split('T')[0]

    if (!statsMap.has(dateKey)) {
      statsMap.set(dateKey, {
        date: dateKey,
        feedingCount: 0,
        sleepTotalMinutes: 0,
        diaperCount: 0,
      })
    }

    const stats = statsMap.get(dateKey)!

    switch (event.event_type) {
      case 'feeding':
        stats.feedingCount++
        break
      case 'sleep':
        stats.sleepTotalMinutes += event.duration_minutes || 0
        break
      case 'diaper':
        stats.diaperCount++
        break
    }
  })

  return Array.from(statsMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function getLast7DaysStats(events: Event[]): DailyStats[] {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentEvents = events.filter(
    (event) => new Date(event.event_time) >= sevenDaysAgo
  )

  return aggregateDailyStats(recentEvents)
}

