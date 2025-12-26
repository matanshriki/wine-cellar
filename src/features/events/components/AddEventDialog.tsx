import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateEvent } from '../hooks/useEvents'
import {
  feedingEventSchema,
  sleepEventSchema,
  diaperEventSchema,
  growthEventSchema,
  noteEventSchema,
  type EventForm,
} from '../validation'

interface AddEventDialogProps {
  babyId: string
  workspaceId: string
}

export function AddEventDialog({ babyId, workspaceId }: AddEventDialogProps) {
  const [open, setOpen] = useState(false)
  const [eventType, setEventType] = useState<'feeding' | 'sleep' | 'diaper' | 'growth' | 'note'>(
    'feeding'
  )
  const createEvent = useCreateEvent(babyId, workspaceId)

  const getSchema = () => {
    switch (eventType) {
      case 'feeding':
        return feedingEventSchema
      case 'sleep':
        return sleepEventSchema
      case 'diaper':
        return diaperEventSchema
      case 'growth':
        return growthEventSchema
      case 'note':
        return noteEventSchema
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<EventForm>({
    resolver: zodResolver(getSchema()),
    defaultValues: {
      event_time: new Date().toISOString().slice(0, 16),
      event_type: eventType,
      metadata: {},
    },
  })

  const onSubmit = async (data: EventForm) => {
    await createEvent.mutateAsync(data)
    setOpen(false)
    reset()
  }

  const handleTabChange = (value: string) => {
    const newType = value as typeof eventType
    setEventType(newType)
    reset({
      event_time: new Date().toISOString().slice(0, 16),
      event_type: newType,
      metadata: {} as any,
    } as any)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg">
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
          <DialogDescription>Record a new activity for your baby</DialogDescription>
        </DialogHeader>

        <Tabs value={eventType} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="feeding">Feed</TabsTrigger>
            <TabsTrigger value="sleep">Sleep</TabsTrigger>
            <TabsTrigger value="diaper">Diaper</TabsTrigger>
            <TabsTrigger value="growth">Growth</TabsTrigger>
            <TabsTrigger value="note">Note</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            {/* Common fields */}
            <div className="space-y-2">
              <Label htmlFor="event_time">Time</Label>
              <Input
                id="event_time"
                type="datetime-local"
                {...register('event_time')}
                disabled={createEvent.isPending}
              />
              {errors.event_time && (
                <p className="text-sm text-destructive">{errors.event_time.message}</p>
              )}
            </div>

            {/* Feeding specific fields */}
            <TabsContent value="feeding" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="method">Method</Label>
                <Select
                  onValueChange={(value) =>
                    setValue('metadata.method' as never, value as never)
                  }
                  defaultValue="breast"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breast">Breast</SelectItem>
                    <SelectItem value="bottle">Bottle</SelectItem>
                    <SelectItem value="pumping">Pumping</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(watch('metadata') as any)?.method === 'breast' && (
                <div className="space-y-2">
                  <Label htmlFor="side">Side</Label>
                  <Select
                    onValueChange={(value) =>
                      setValue('metadata.side' as never, value as never)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select side" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount_ml">Amount (ml)</Label>
                <Input
                  id="amount_ml"
                  type="number"
                  {...register('metadata.amount_ml' as never, { valueAsNumber: true })}
                  disabled={createEvent.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  {...register('duration_minutes' as never, { valueAsNumber: true })}
                  disabled={createEvent.isPending}
                />
              </div>
            </TabsContent>

            {/* Sleep specific fields */}
            <TabsContent value="sleep" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="sleep_duration">Duration (minutes)</Label>
                <Input
                  id="sleep_duration"
                  type="number"
                  {...register('duration_minutes' as never, { valueAsNumber: true })}
                  disabled={createEvent.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quality">Quality</Label>
                <Select
                  onValueChange={(value) =>
                    setValue('metadata.quality' as never, value as never)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="excellent">Excellent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Diaper specific fields */}
            <TabsContent value="diaper" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="diaper_type">Type</Label>
                <Select
                  onValueChange={(value) => setValue('metadata.type' as never, value as never)}
                  defaultValue="wet"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wet">Wet</SelectItem>
                    <SelectItem value="dirty">Dirty</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Growth specific fields */}
            <TabsContent value="growth" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="weight_kg">Weight (kg)</Label>
                <Input
                  id="weight_kg"
                  type="number"
                  step="0.01"
                  {...register('metadata.weight_kg' as never, { valueAsNumber: true })}
                  disabled={createEvent.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="height_cm">Height (cm)</Label>
                <Input
                  id="height_cm"
                  type="number"
                  step="0.1"
                  {...register('metadata.height_cm' as never, { valueAsNumber: true })}
                  disabled={createEvent.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="head_circumference_cm">Head Circumference (cm)</Label>
                <Input
                  id="head_circumference_cm"
                  type="number"
                  step="0.1"
                  {...register('metadata.head_circumference_cm' as never, {
                    valueAsNumber: true,
                  })}
                  disabled={createEvent.isPending}
                />
              </div>
            </TabsContent>

            {/* Note specific fields */}
            <TabsContent value="note" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  {...register('metadata.category' as never)}
                  placeholder="e.g., Milestone, Health"
                  disabled={createEvent.isPending}
                />
              </div>
            </TabsContent>

            {/* Common notes field */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Add any additional notes..."
                disabled={createEvent.isPending}
              />
            </div>

            <Button type="submit" className="w-full" disabled={createEvent.isPending}>
              {createEvent.isPending ? 'Adding...' : 'Add Event'}
            </Button>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

