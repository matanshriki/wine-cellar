export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          created_by?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: 'owner' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'owner' | 'member'
          joined_at?: string
        }
      }
      babies: {
        Row: {
          id: string
          workspace_id: string
          name: string
          date_of_birth: string | null
          photo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          date_of_birth?: string | null
          photo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          date_of_birth?: string | null
          photo_url?: string | null
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          baby_id: string
          workspace_id: string
          event_type: 'feeding' | 'sleep' | 'diaper' | 'growth' | 'note'
          event_time: string
          duration_minutes: number | null
          metadata: Json
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          baby_id: string
          workspace_id: string
          event_type: 'feeding' | 'sleep' | 'diaper' | 'growth' | 'note'
          event_time: string
          duration_minutes?: number | null
          metadata?: Json
          notes?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          baby_id?: string
          workspace_id?: string
          event_type?: 'feeding' | 'sleep' | 'diaper' | 'growth' | 'note'
          event_time?: string
          duration_minutes?: number | null
          metadata?: Json
          notes?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      invites: {
        Row: {
          id: string
          workspace_id: string
          email: string
          invited_by: string
          status: 'pending' | 'accepted' | 'expired'
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          email: string
          invited_by: string
          status?: 'pending' | 'accepted' | 'expired'
          created_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          workspace_id?: string
          email?: string
          invited_by?: string
          status?: 'pending' | 'accepted' | 'expired'
          created_at?: string
          expires_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

