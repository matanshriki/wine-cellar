import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { useEvents } from '@/features/events/hooks/useEvents'
import { exportEventsToCSV } from '../utils/csvExport'

export function ExportPage() {
  const { babyId, workspaceId } = useParams<{ babyId: string; workspaceId: string }>()
  const { toast } = useToast()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: allEvents } = useEvents(babyId)

  if (!babyId || !workspaceId) {
    return <div>Invalid parameters</div>
  }

  const handleExport = () => {
    if (!allEvents || allEvents.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No data',
        description: 'There are no events to export',
      })
      return
    }

    let filteredEvents = allEvents

    // Filter by date range if specified
    if (startDate || endDate) {
      filteredEvents = allEvents.filter((event) => {
        const eventDate = new Date(event.event_time)
        if (startDate && eventDate < new Date(startDate)) return false
        if (endDate && eventDate > new Date(endDate + 'T23:59:59')) return false
        return true
      })
    }

    if (filteredEvents.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No data in range',
        description: 'There are no events in the selected date range',
      })
      return
    }

    const filename = `baby-events-${startDate || 'all'}-to-${endDate || 'today'}.csv`
    exportEventsToCSV(filteredEvents, filename)

    toast({
      title: 'Export successful',
      description: `Exported ${filteredEvents.length} events to CSV`,
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/app/workspace/${workspaceId}/baby/${babyId}/timeline`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Export Data</h1>
      </div>

      {/* Export Card */}
      <Card>
        <CardHeader>
          <CardTitle>Export to CSV</CardTitle>
          <CardDescription>
            Download your baby's activity data in CSV format for use in spreadsheets or medical
            records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date (Optional)</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {allEvents ? (
              <p>Total events available: {allEvents.length}</p>
            ) : (
              <p>Loading events...</p>
            )}
          </div>

          <Button onClick={handleExport} className="w-full" disabled={!allEvents}>
            <Download className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

