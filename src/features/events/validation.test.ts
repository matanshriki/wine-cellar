import { describe, it, expect } from 'vitest'
import {
  feedingEventSchema,
  sleepEventSchema,
  diaperEventSchema,
  growthEventSchema,
  noteEventSchema,
} from './validation'

describe('Event Validation', () => {
  describe('feedingEventSchema', () => {
    it('should validate a valid feeding event', () => {
      const validEvent = {
        event_type: 'feeding' as const,
        event_time: '2024-01-01T12:00:00Z',
        metadata: {
          method: 'breast' as const,
          side: 'left' as const,
          amount_ml: 100,
        },
        duration_minutes: 15,
        notes: 'Good feeding session',
      }

      const result = feedingEventSchema.safeParse(validEvent)
      expect(result.success).toBe(true)
    })

    it('should reject invalid feeding method', () => {
      const invalidEvent = {
        event_type: 'feeding' as const,
        event_time: '2024-01-01T12:00:00Z',
        metadata: {
          method: 'invalid',
        },
      }

      const result = feedingEventSchema.safeParse(invalidEvent)
      expect(result.success).toBe(false)
    })
  })

  describe('sleepEventSchema', () => {
    it('should validate a valid sleep event', () => {
      const validEvent = {
        event_type: 'sleep' as const,
        event_time: '2024-01-01T20:00:00Z',
        metadata: {
          quality: 'good' as const,
        },
        duration_minutes: 120,
      }

      const result = sleepEventSchema.safeParse(validEvent)
      expect(result.success).toBe(true)
    })
  })

  describe('diaperEventSchema', () => {
    it('should validate a valid diaper event', () => {
      const validEvent = {
        event_type: 'diaper' as const,
        event_time: '2024-01-01T14:00:00Z',
        metadata: {
          type: 'wet' as const,
        },
      }

      const result = diaperEventSchema.safeParse(validEvent)
      expect(result.success).toBe(true)
    })

    it('should require diaper type', () => {
      const invalidEvent = {
        event_type: 'diaper' as const,
        event_time: '2024-01-01T14:00:00Z',
        metadata: {},
      }

      const result = diaperEventSchema.safeParse(invalidEvent)
      expect(result.success).toBe(false)
    })
  })

  describe('growthEventSchema', () => {
    it('should validate a valid growth event', () => {
      const validEvent = {
        event_type: 'growth' as const,
        event_time: '2024-01-01T10:00:00Z',
        metadata: {
          weight_kg: 4.5,
          height_cm: 52.3,
          head_circumference_cm: 36.5,
        },
      }

      const result = growthEventSchema.safeParse(validEvent)
      expect(result.success).toBe(true)
    })

    it('should reject negative measurements', () => {
      const invalidEvent = {
        event_type: 'growth' as const,
        event_time: '2024-01-01T10:00:00Z',
        metadata: {
          weight_kg: -1,
        },
      }

      const result = growthEventSchema.safeParse(invalidEvent)
      expect(result.success).toBe(false)
    })
  })

  describe('noteEventSchema', () => {
    it('should validate a valid note event', () => {
      const validEvent = {
        event_type: 'note' as const,
        event_time: '2024-01-01T16:00:00Z',
        metadata: {
          category: 'Milestone',
        },
        notes: 'First smile!',
      }

      const result = noteEventSchema.safeParse(validEvent)
      expect(result.success).toBe(true)
    })
  })
})

