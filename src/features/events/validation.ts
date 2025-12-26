import { z } from 'zod'

// Base event schema
export const baseEventSchema = z.object({
  event_time: z.string(),
  notes: z.string().optional(),
})

// Feeding event
export const feedingMetadataSchema = z.object({
  method: z.enum(['breast', 'bottle', 'pumping']),
  side: z.enum(['left', 'right', 'both']).optional(),
  amount_ml: z.number().min(0).optional(),
})

export const feedingEventSchema = baseEventSchema.extend({
  event_type: z.literal('feeding'),
  duration_minutes: z.number().min(0).optional(),
  metadata: feedingMetadataSchema,
})

// Sleep event
export const sleepMetadataSchema = z.object({
  quality: z.enum(['poor', 'fair', 'good', 'excellent']).optional(),
})

export const sleepEventSchema = baseEventSchema.extend({
  event_type: z.literal('sleep'),
  duration_minutes: z.number().min(0).optional(),
  metadata: sleepMetadataSchema,
})

// Diaper event
export const diaperMetadataSchema = z.object({
  type: z.enum(['wet', 'dirty', 'both']),
})

export const diaperEventSchema = baseEventSchema.extend({
  event_type: z.literal('diaper'),
  metadata: diaperMetadataSchema,
})

// Growth event
export const growthMetadataSchema = z.object({
  weight_kg: z.number().min(0).optional(),
  height_cm: z.number().min(0).optional(),
  head_circumference_cm: z.number().min(0).optional(),
})

export const growthEventSchema = baseEventSchema.extend({
  event_type: z.literal('growth'),
  metadata: growthMetadataSchema,
})

// Note event
export const noteMetadataSchema = z.object({
  category: z.string().optional(),
})

export const noteEventSchema = baseEventSchema.extend({
  event_type: z.literal('note'),
  metadata: noteMetadataSchema,
})

// Union type for all events
export const eventSchema = z.discriminatedUnion('event_type', [
  feedingEventSchema,
  sleepEventSchema,
  diaperEventSchema,
  growthEventSchema,
  noteEventSchema,
])

export type FeedingEventForm = z.infer<typeof feedingEventSchema>
export type SleepEventForm = z.infer<typeof sleepEventSchema>
export type DiaperEventForm = z.infer<typeof diaperEventSchema>
export type GrowthEventForm = z.infer<typeof growthEventSchema>
export type NoteEventForm = z.infer<typeof noteEventSchema>
export type EventForm = z.infer<typeof eventSchema>

