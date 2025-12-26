import { useMemo } from 'react'
import { Event } from '@/types/models'
import { EventCard } from '@/features/events/components/EventCard'
import { formatDate, startOfDay } from '@/lib/utils'

interface EventListProps {
  events: Event[]
  babyId: string
}

export function EventList({ events, babyId }: EventListProps) {
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, Event[]>()

    events.forEach((event) => {
      const eventDate = new Date(event.event_time)
      const dayStart = startOfDay(eventDate)
      const key = dayStart.toISOString()

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(event)
    })

    // Sort groups by date (newest first)
    return Array.from(groups.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([date, events]) => ({
        date: new Date(date),
        events: events.sort(
          (a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime()
        ),
      }))
  }, [events])

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No events yet. Tap the + button to add your first event!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groupedEvents.map((group) => (
        <div key={group.date.toISOString()}>
          <h3 className="text-lg font-semibold mb-3 sticky top-0 bg-gray-50 py-2 z-10">
            {formatDate(group.date)}
          </h3>
          <div className="space-y-3">
            {group.events.map((event) => (
              <EventCard key={event.id} event={event} babyId={babyId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

