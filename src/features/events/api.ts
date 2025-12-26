import { supabase } from '@/lib/supabase'
import { Event } from '@/types/models'
import { EventForm } from './validation'

export async function getEvents(babyId: string, startDate?: Date, endDate?: Date) {
  let query = supabase
    .from('events')
    .select('*')
    .eq('baby_id', babyId)
    .order('event_time', { ascending: false })

  if (startDate) {
    query = query.gte('event_time', startDate.toISOString())
  }

  if (endDate) {
    query = query.lte('event_time', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) throw error
  return data as Event[]
}

export async function createEvent(babyId: string, workspaceId: string, eventData: EventForm) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('events')
    .insert({
      baby_id: babyId,
      workspace_id: workspaceId,
      event_type: eventData.event_type,
      event_time: eventData.event_time,
      duration_minutes: 'duration_minutes' in eventData ? eventData.duration_minutes : null,
      metadata: eventData.metadata as any,
      notes: eventData.notes || null,
      created_by: user.id,
    } as any)
    .select()
    .single()

  if (error) throw error
  return data as Event
}

export async function updateEvent(eventId: string, eventData: Partial<EventForm>) {
  const updateData: Record<string, unknown> = {}

  if (eventData.event_time) updateData.event_time = eventData.event_time
  if ('duration_minutes' in eventData) updateData.duration_minutes = eventData.duration_minutes
  if (eventData.metadata) updateData.metadata = eventData.metadata
  if (eventData.notes !== undefined) updateData.notes = eventData.notes

  const { data, error } = await supabase
    .from('events')
    .update(updateData as never)
    .eq('id', eventId)
    .select()
    .single()

  if (error) throw error
  return data as Event
}

export async function deleteEvent(eventId: string) {
  const { error } = await supabase.from('events').delete().eq('id', eventId)

  if (error) throw error
}

export async function getLastEvents(babyId: string) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('baby_id', babyId)
    .order('event_time', { ascending: false })
    .limit(50)

  if (error) throw error

  const events = data as Event[]

  // Get last event of each type
  const lastEvents = {
    feeding: events.find((e) => e.event_type === 'feeding'),
    sleep: events.find((e) => e.event_type === 'sleep'),
    diaper: events.find((e) => e.event_type === 'diaper'),
  }

  return lastEvents
}

