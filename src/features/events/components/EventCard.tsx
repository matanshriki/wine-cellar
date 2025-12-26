import { Trash2, Baby, Moon, Droplets, TrendingUp, FileText } from 'lucide-react'
import { Event, FeedingMetadata, SleepMetadata, DiaperMetadata, GrowthMetadata } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatTime, formatDuration, getRelativeTime } from '@/lib/utils'
import { useDeleteEvent } from '../hooks/useEvents'

interface EventCardProps {
  event: Event
  babyId: string
}

export function EventCard({ event, babyId }: EventCardProps) {
  const deleteEvent = useDeleteEvent(babyId)

  const getEventIcon = () => {
    switch (event.event_type) {
      case 'feeding':
        return <Baby className="h-5 w-5" />
      case 'sleep':
        return <Moon className="h-5 w-5" />
      case 'diaper':
        return <Droplets className="h-5 w-5" />
      case 'growth':
        return <TrendingUp className="h-5 w-5" />
      case 'note':
        return <FileText className="h-5 w-5" />
    }
  }

  const getEventColor = () => {
    switch (event.event_type) {
      case 'feeding':
        return 'bg-blue-100 text-blue-700'
      case 'sleep':
        return 'bg-purple-100 text-purple-700'
      case 'diaper':
        return 'bg-yellow-100 text-yellow-700'
      case 'growth':
        return 'bg-green-100 text-green-700'
      case 'note':
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getEventDetails = () => {
    const metadata = event.metadata as any

    switch (event.event_type) {
      case 'feeding': {
        const data = metadata as FeedingMetadata
        const parts: string[] = [data.method]
        if (data.side) parts.push(`(${data.side})`)
        if (data.amount_ml) parts.push(`${data.amount_ml}ml`)
        if (event.duration_minutes) parts.push(formatDuration(event.duration_minutes))
        return parts.join(' • ')
      }
      case 'sleep': {
        const data = metadata as SleepMetadata
        const parts: string[] = []
        if (event.duration_minutes) parts.push(formatDuration(event.duration_minutes))
        if (data.quality) parts.push(data.quality)
        return parts.join(' • ') || 'Sleep'
      }
      case 'diaper': {
        const data = metadata as DiaperMetadata
        return data.type.charAt(0).toUpperCase() + data.type.slice(1)
      }
      case 'growth': {
        const data = metadata as GrowthMetadata
        const parts: string[] = []
        if (data.weight_kg) parts.push(`${data.weight_kg}kg`)
        if (data.height_cm) parts.push(`${data.height_cm}cm`)
        if (data.head_circumference_cm) parts.push(`HC: ${data.head_circumference_cm}cm`)
        return parts.join(' • ') || 'Growth measurement'
      }
      case 'note':
        return 'Note'
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      await deleteEvent.mutateAsync(event.id)
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className={`p-2 rounded-full ${getEventColor()}`}>{getEventIcon()}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="font-medium text-sm capitalize">{event.event_type}</p>
                <span className="text-xs text-muted-foreground">{getRelativeTime(event.event_time)}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{getEventDetails()}</p>
              <p className="text-xs text-muted-foreground">{formatTime(event.event_time)}</p>
              {event.notes && (
                <p className="text-sm mt-2 text-gray-700 bg-gray-50 rounded p-2">{event.notes}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleteEvent.isPending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

