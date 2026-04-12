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

export interface TasteProfileVector {
  body: number;
  tannin: number;
  acidity: number;
  oak: number;
  sweetness: number;
  power: number;
}

export interface TasteProfilePreferences {
  reds_bias: number;
  whites_bias: number;
  sparkling_bias: number;
  style_tags: Record<string, number>;
  regions: Record<string, number>;
  grapes: Record<string, number>;
}

export interface TasteProfile {
  version: number;
  vector: TasteProfileVector;
  preferences: TasteProfilePreferences;
  overrides?: {
    vector?: Partial<TasteProfileVector>;
  };
  confidence: 'low' | 'med' | 'high';
  data_points: {
    rated_count: number;
    last_rated_at: string | null;
  };
}

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
          plan_evening_enabled: boolean
          taste_profile: TasteProfile | null
          taste_profile_updated_at: string | null
          taste_profile_version: number
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
          plan_evening_enabled?: boolean
          taste_profile?: TasteProfile | null
          taste_profile_updated_at?: string | null
          taste_profile_version?: number
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
          plan_evening_enabled?: boolean
          taste_profile?: TasteProfile | null
          taste_profile_updated_at?: string | null
          taste_profile_version?: number
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
          translations: Json | null
          barrel_aging_note: string | null
          barrel_aging_months_est: number | null
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
          translations?: Json | null
          barrel_aging_note?: string | null
          barrel_aging_months_est?: number | null
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
          translations?: Json | null
          barrel_aging_note?: string | null
          barrel_aging_months_est?: number | null
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
          /** Keep/Reserve feature */
          is_reserved: boolean
          reserved_for: string | null
          reserved_date: string | null
          reserved_note: string | null
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
          /** Keep/Reserve feature */
          is_reserved?: boolean
          reserved_for?: string | null
          reserved_date?: string | null
          reserved_note?: string | null
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
          /** Keep/Reserve feature */
          is_reserved?: boolean
          reserved_for?: string | null
          reserved_date?: string | null
          reserved_note?: string | null
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
      evening_plans: {
        Row: {
          id: string
          user_id: string
          status: 'active' | 'completed' | 'cancelled'
          plan_name: string | null
          occasion: string | null
          group_size: string | null
          settings: Json
          queue: Json
          now_playing_index: number
          created_at: string
          updated_at: string
          completed_at: string | null
          total_bottles_opened: number
          average_rating: number | null
        }
        Insert: {
          id?: string
          user_id: string
          status?: 'active' | 'completed' | 'cancelled'
          plan_name?: string | null
          occasion?: string | null
          group_size?: string | null
          settings?: Json
          queue: Json
          now_playing_index?: number
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          total_bottles_opened?: number
          average_rating?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          status?: 'active' | 'completed' | 'cancelled'
          plan_name?: string | null
          occasion?: string | null
          group_size?: string | null
          settings?: Json
          queue?: Json
          now_playing_index?: number
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          total_bottles_opened?: number
          average_rating?: number | null
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
      sommelier_conversations: {
        Row: {
          id: string
          user_id: string
          title: string | null
          messages: Json
          created_at: string
          updated_at: string
          last_message_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          messages?: Json
          created_at?: string
          updated_at?: string
          last_message_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          messages?: Json
          created_at?: string
          updated_at?: string
          last_message_at?: string
        }
      }
      // ── Sommi credits (Phase 1) ─────────────────────────────────
      user_entitlements: {
        Row: {
          user_id: string
          monetization_enabled: boolean
          credit_enforcement_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          monetization_enabled?: boolean
          credit_enforcement_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          monetization_enabled?: boolean
          credit_enforcement_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_ai_credits: {
        Row: {
          id: string
          user_id: string
          monthly_limit: number
          credit_balance: number
          bonus_credits: number
          plan_key: string | null
          billing_status: string | null
          current_period_start: string | null
          current_period_end: string | null
          billing_period_end: string | null
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          lifetime_credits_used: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          monthly_limit?: number
          credit_balance?: number
          bonus_credits?: number
          plan_key?: string | null
          billing_status?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          billing_period_end?: string | null
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          lifetime_credits_used?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          monthly_limit?: number
          credit_balance?: number
          bonus_credits?: number
          plan_key?: string | null
          billing_status?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          billing_period_end?: string | null
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          lifetime_credits_used?: number
          created_at?: string
          updated_at?: string
        }
      }
      ai_usage_events: {
        Row: {
          id: string
          user_id: string
          action_type: string
          credits_used: number
          estimated_cost_usd: number | null
          request_status: string
          request_id: string | null
          model_name: string | null
          input_tokens: number | null
          output_tokens: number | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action_type: string
          credits_used?: number
          estimated_cost_usd?: number | null
          request_status?: string
          request_id?: string | null
          model_name?: string | null
          input_tokens?: number | null
          output_tokens?: number | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action_type?: string
          credits_used?: number
          estimated_cost_usd?: number | null
          request_status?: string
          request_id?: string | null
          model_name?: string | null
          input_tokens?: number | null
          output_tokens?: number | null
          metadata?: Json
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
      ai_credit_usage_summary: {
        Row: {
          user_id: string
          action_type: string
          total_events: number
          total_credits_used: number
          total_estimated_cost_usd: number | null
          total_input_tokens: number | null
          total_output_tokens: number | null
          success_count: number
          blocked_count: number
          last_event_at: string | null
        }
      }
    }
    Functions: {
      process_ai_credit_usage: {
        Args: {
          p_user_id: string
          p_action_type: string
          p_credits_required: number
          p_request_id?: string | null
          p_model_name?: string | null
          p_input_tokens?: number | null
          p_output_tokens?: number | null
          p_estimated_cost_usd?: number | null
          p_metadata?: Json
          p_request_status?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
