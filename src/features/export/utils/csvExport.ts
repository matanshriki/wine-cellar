import { Event } from '@/types/models'
import { formatDateTime } from '@/lib/utils'

export function exportEventsToCSV(events: Event[], filename: string = 'baby-events.csv') {
  // Define CSV headers
  const headers = [
    'Date & Time',
    'Event Type',
    'Duration (min)',
    'Details',
    'Notes',
  ]

  // Convert events to CSV rows
  const rows = events.map((event) => {
    const metadata = event.metadata as Record<string, unknown>
    let details = ''

    switch (event.event_type) {
      case 'feeding':
        details = `Method: ${metadata.method || ''}, Side: ${metadata.side || ''}, Amount: ${metadata.amount_ml || ''}ml`
        break
      case 'sleep':
        details = `Quality: ${metadata.quality || ''}`
        break
      case 'diaper':
        details = `Type: ${metadata.type || ''}`
        break
      case 'growth':
        details = `Weight: ${metadata.weight_kg || ''}kg, Height: ${metadata.height_cm || ''}cm, HC: ${metadata.head_circumference_cm || ''}cm`
        break
      case 'note':
        details = `Category: ${metadata.category || ''}`
        break
    }

    return [
      formatDateTime(event.event_time),
      event.event_type,
      event.duration_minutes?.toString() || '',
      details,
      event.notes || '',
    ]
  })

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

