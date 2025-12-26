import { Database } from './database'

export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']
export type Baby = Database['public']['Tables']['babies']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type Invite = Database['public']['Tables']['invites']['Row']

export type EventType = 'feeding' | 'sleep' | 'diaper' | 'growth' | 'note'

// Event metadata types
export interface FeedingMetadata {
  method: 'breast' | 'bottle' | 'pumping'
  side?: 'left' | 'right' | 'both'
  amount_ml?: number
}

export interface SleepMetadata {
  quality?: 'poor' | 'fair' | 'good' | 'excellent'
}

export interface DiaperMetadata {
  type: 'wet' | 'dirty' | 'both'
}

export interface GrowthMetadata {
  weight_kg?: number
  height_cm?: number
  head_circumference_cm?: number
}

export interface NoteMetadata {
  category?: string
}

export type EventMetadata =
  | FeedingMetadata
  | SleepMetadata
  | DiaperMetadata
  | GrowthMetadata
  | NoteMetadata

// Extended types with relations
export interface EventWithCreator extends Event {
  creator?: {
    email: string
  }
}

export interface BabyWithWorkspace extends Baby {
  workspace: Workspace
}

