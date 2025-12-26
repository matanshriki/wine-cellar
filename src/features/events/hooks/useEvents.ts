import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEvents, createEvent, updateEvent, deleteEvent, getLastEvents } from '../api'
import { EventForm } from '../validation'
import { useToast } from '@/components/ui/use-toast'

export function useEvents(babyId: string | undefined, startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['events', babyId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => getEvents(babyId!, startDate, endDate),
    enabled: !!babyId,
  })
}

export function useLastEvents(babyId: string | undefined) {
  return useQuery({
    queryKey: ['lastEvents', babyId],
    queryFn: () => getLastEvents(babyId!),
    enabled: !!babyId,
  })
}

export function useCreateEvent(babyId: string, workspaceId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (eventData: EventForm) => createEvent(babyId, workspaceId, eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', babyId] })
      queryClient.invalidateQueries({ queryKey: ['lastEvents', babyId] })
      toast({
        title: 'Event created',
        description: 'The event has been added successfully.',
      })
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create event',
      })
    },
  })
}

export function useUpdateEvent(babyId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: ({ eventId, eventData }: { eventId: string; eventData: Partial<EventForm> }) =>
      updateEvent(eventId, eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', babyId] })
      queryClient.invalidateQueries({ queryKey: ['lastEvents', babyId] })
      toast({
        title: 'Event updated',
        description: 'The event has been updated successfully.',
      })
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update event',
      })
    },
  })
}

export function useDeleteEvent(babyId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', babyId] })
      queryClient.invalidateQueries({ queryKey: ['lastEvents', babyId] })
      toast({
        title: 'Event deleted',
        description: 'The event has been deleted successfully.',
      })
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete event',
      })
    },
  })
}

