import { Button } from '@/components/ui/button'
import { EventType } from '@/types/models'

interface EventFiltersProps {
  selectedTypes: EventType[]
  onToggleType: (type: EventType) => void
}

const eventTypes: { type: EventType; label: string; color: string }[] = [
  { type: 'feeding', label: 'Feeding', color: 'bg-blue-500' },
  { type: 'sleep', label: 'Sleep', color: 'bg-purple-500' },
  { type: 'diaper', label: 'Diaper', color: 'bg-yellow-500' },
  { type: 'growth', label: 'Growth', color: 'bg-green-500' },
  { type: 'note', label: 'Notes', color: 'bg-gray-500' },
]

export function EventFilters({ selectedTypes, onToggleType }: EventFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {eventTypes.map(({ type, label, color }) => {
        const isSelected = selectedTypes.includes(type)
        return (
          <Button
            key={type}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggleType(type)}
            className={isSelected ? color : ''}
          >
            {label}
          </Button>
        )
      })}
    </div>
  )
}

