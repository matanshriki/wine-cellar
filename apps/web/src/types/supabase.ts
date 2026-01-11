/**
 * Supabase Database Types
 * 
 * These types match the database schema defined in migrations.
 * In production, generate these with: npx supabase gen types typescript --local
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          first_name: string | null
          last_name: string | null
          email: string | null
          avatar_url: string | null
          preferred_language: string
          cellar_agent_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          avatar_url?: string | null
          preferred_language?: string
          cellar_agent_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          avatar_url?: string | null
          preferred_language?: string
          cellar_agent_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      wines: {
        Row: {
          id: string
          user_id: string
          producer: string
          wine_name: string
          vintage: number | null
          country: string | null
          region: string | null
          appellation: string | null
          color: 'red' | 'white' | 'rose' | 'sparkling'
          grapes: Json | null
          vivino_wine_id: string | null
          notes: string | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          producer: string
          wine_name: string
          vintage?: number | null
          country?: string | null
          region?: string | null
          appellation?: string | null
          color: 'red' | 'white' | 'rose' | 'sparkling'
          grapes?: Json | null
          vivino_wine_id?: string | null
          notes?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          producer?: string
          wine_name?: string
          vintage?: number | null
          country?: string | null
          region?: string | null
          appellation?: string | null
          color?: 'red' | 'white' | 'rose' | 'sparkling'
          grapes?: Json | null
          vivino_wine_id?: string | null
          notes?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bottles: {
        Row: {
          id: string
          user_id: string
          wine_id: string
          quantity: number
          purchase_date: string | null
          purchase_price: number | null
          purchase_location: string | null
          storage_location: string | null
          bottle_size_ml: number
          drink_window_start: number | null
          drink_window_end: number | null
          readiness_status: 'TooYoung' | 'Approaching' | 'InWindow' | 'Peak' | 'PastPeak' | 'Unknown' | null
          readiness_score: number | null
          serve_temp_c: number | null
          decant_minutes: number | null
          analysis_notes: string | null
          analyzed_at: string | null
          tags: Json | null
          image_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          wine_id: string
          quantity?: number
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_location?: string | null
          storage_location?: string | null
          bottle_size_ml?: number
          drink_window_start?: number | null
          drink_window_end?: number | null
          readiness_status?: 'TooYoung' | 'Approaching' | 'InWindow' | 'Peak' | 'PastPeak' | 'Unknown' | null
          readiness_score?: number | null
          serve_temp_c?: number | null
          decant_minutes?: number | null
          analysis_notes?: string | null
          analyzed_at?: string | null
          tags?: Json | null
          image_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          wine_id?: string
          quantity?: number
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_location?: string | null
          storage_location?: string | null
          bottle_size_ml?: number
          drink_window_start?: number | null
          drink_window_end?: number | null
          readiness_status?: 'TooYoung' | 'Approaching' | 'InWindow' | 'Peak' | 'PastPeak' | 'Unknown' | null
          readiness_score?: number | null
          serve_temp_c?: number | null
          decant_minutes?: number | null
          analysis_notes?: string | null
          analyzed_at?: string | null
          tags?: Json | null
          image_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      consumption_history: {
        Row: {
          id: string
          user_id: string
          bottle_id: string
          wine_id: string
          opened_at: string
          occasion: string | null
          meal_type: string | null
          user_rating: number | null
          tasting_notes: string | null
          meal_notes: string | null
          vibe: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bottle_id: string
          wine_id: string
          opened_at?: string
          occasion?: string | null
          meal_type?: string | null
          user_rating?: number | null
          tasting_notes?: string | null
          meal_notes?: string | null
          vibe?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bottle_id?: string
          wine_id?: string
          opened_at?: string
          occasion?: string | null
          meal_type?: string | null
          user_rating?: number | null
          tasting_notes?: string | null
          meal_notes?: string | null
          vibe?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      recommendation_runs: {
        Row: {
          id: string
          user_id: string
          input_payload: Json
          output_payload: Json
          recommendation_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          input_payload: Json
          output_payload: Json
          recommendation_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          input_payload?: Json
          output_payload?: Json
          recommendation_count?: number
          created_at?: string
        }
      }
    }
    Views: {
      bottles_with_wine_info: {
        Row: {
          // Bottle fields
          id: string
          user_id: string
          wine_id: string
          quantity: number
          purchase_date: string | null
          purchase_price: number | null
          purchase_location: string | null
          storage_location: string | null
          bottle_size_ml: number
          drink_window_start: number | null
          drink_window_end: number | null
          readiness_status: string | null
          readiness_score: number | null
          serve_temp_c: number | null
          decant_minutes: number | null
          analysis_notes: string | null
          analyzed_at: string | null
          tags: Json | null
          image_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
          // Wine fields
          producer: string
          wine_name: string
          vintage: number | null
          country: string | null
          region: string | null
          appellation: string | null
          color: string
          grapes: Json | null
          vivino_wine_id: string | null
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

