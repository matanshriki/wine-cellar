import { Baby, Moon, Droplets } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getRelativeTime } from '@/lib/utils'
import { useLastEvents } from '../hooks/useEvents'

interface LastEventCardsProps {
  babyId: string
}

export function LastEventCards({ babyId }: LastEventCardsProps) {
  const { data: lastEvents, isLoading } = useLastEvents(babyId)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!lastEvents) return null

  const cards = [
    {
      title: 'Last Feeding',
      icon: <Baby className="h-5 w-5" />,
      event: lastEvents.feeding,
      color: 'text-blue-600',
    },
    {
      title: 'Last Sleep',
      icon: <Moon className="h-5 w-5" />,
      event: lastEvents.sleep,
      color: 'text-purple-600',
    },
    {
      title: 'Last Diaper',
      icon: <Droplets className="h-5 w-5" />,
      event: lastEvents.diaper,
      color: 'text-yellow-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <span className={card.color}>{card.icon}</span>
              <span>{card.title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {card.event ? (
              <p className="text-2xl font-bold">{getRelativeTime(card.event.event_time)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No events yet</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

