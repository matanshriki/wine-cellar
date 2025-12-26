import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEvents } from '@/features/events/hooks/useEvents'
import { StatsCharts } from '../components/StatsCharts'
import { getLast7DaysStats } from '../utils/aggregations'

export function StatsPage() {
  const { babyId, workspaceId } = useParams<{ babyId: string; workspaceId: string }>()
  const { data: events, isLoading } = useEvents(babyId)

  if (!babyId || !workspaceId) {
    return <div>Invalid parameters</div>
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading stats...</p>
      </div>
    )
  }

  const stats = events ? getLast7DaysStats(events) : []

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/app/workspace/${workspaceId}/baby/${babyId}/timeline`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Statistics & Trends</h1>
        </div>
      </div>

      {/* Charts */}
      {stats.length > 0 ? (
        <StatsCharts stats={stats} />
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Not enough data yet. Start tracking events to see trends!</p>
        </div>
      )}
    </div>
  )
}

