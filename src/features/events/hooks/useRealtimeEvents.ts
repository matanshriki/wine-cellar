import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Event } from '@/types/models'

export function useRealtimeEvents(babyId: string | undefined, workspaceId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!babyId || !workspaceId) return

    const channel = supabase
      .channel(`events:${babyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `baby_id=eq.${babyId}`,
        },
        (payload) => {
          const newEvent = payload.new as Event

          // Update events query cache
          queryClient.setQueryData(['events', babyId], (old: Event[] | undefined) => {
            if (!old) return [newEvent]
            return [newEvent, ...old]
          })

          // Invalidate last events
          queryClient.invalidateQueries({ queryKey: ['lastEvents', babyId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `baby_id=eq.${babyId}`,
        },
        (payload) => {
          const updatedEvent = payload.new as Event

          // Update events query cache
          queryClient.setQueryData(['events', babyId], (old: Event[] | undefined) => {
            if (!old) return [updatedEvent]
            return old.map((event) => (event.id === updatedEvent.id ? updatedEvent : event))
          })

          // Invalidate last events
          queryClient.invalidateQueries({ queryKey: ['lastEvents', babyId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'events',
          filter: `baby_id=eq.${babyId}`,
        },
        (payload) => {
          const deletedEvent = payload.old as Event

          // Update events query cache
          queryClient.setQueryData(['events', babyId], (old: Event[] | undefined) => {
            if (!old) return []
            return old.filter((event) => event.id !== deletedEvent.id)
          })

          // Invalidate last events
          queryClient.invalidateQueries({ queryKey: ['lastEvents', babyId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [babyId, workspaceId, queryClient])
}

