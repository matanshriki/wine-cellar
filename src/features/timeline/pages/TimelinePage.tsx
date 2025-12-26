import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart3, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEvents } from '@/features/events/hooks/useEvents'
import { useRealtimeEvents } from '@/features/events/hooks/useRealtimeEvents'
import { AddEventDialog } from '@/features/events/components/AddEventDialog'
import { LastEventCards } from '@/features/events/components/LastEventCards'
import { EventList } from '../components/EventList'
import { EventFilters } from '../components/EventFilters'
import { EventType } from '@/types/models'

export function TimelinePage() {
  const { babyId, workspaceId } = useParams<{ babyId: string; workspaceId: string }>()
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>([
    'feeding',
    'sleep',
    'diaper',
    'growth',
    'note',
  ])

  const { data: events, isLoading } = useEvents(babyId)

  // Enable realtime updates
  useRealtimeEvents(babyId, workspaceId)

  const filteredEvents = useMemo(() => {
    if (!events) return []
    return events.filter((event) => selectedTypes.includes(event.event_type))
  }, [events, selectedTypes])

  const handleToggleType = (type: EventType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  if (!babyId || !workspaceId) {
    return <div>Invalid parameters</div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Timeline</h1>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/app/workspace/${workspaceId}/baby/${babyId}/stats`}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Stats
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/app/workspace/${workspaceId}/baby/${babyId}/export`}>
              <FileDown className="h-4 w-4 mr-2" />
              Export
            </Link>
          </Button>
        </div>
      </div>

      {/* Last Event Cards */}
      <LastEventCards babyId={babyId} />

      {/* Filters */}
      <EventFilters selectedTypes={selectedTypes} onToggleType={handleToggleType} />

      {/* Event List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading events...</p>
        </div>
      ) : (
        <EventList events={filteredEvents} babyId={babyId} />
      )}

      {/* Add Event Button */}
      <AddEventDialog babyId={babyId} workspaceId={workspaceId} />
    </div>
  )
}

