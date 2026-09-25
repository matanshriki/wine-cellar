/**
 * Cellar Sommelier Service (Production)
 * 
 * Client-side service for communicating with the Cellar Sommelier API.
 * Access is controlled by feature flags (cellar_agent_enabled).
 */

import { supabase } from '../lib/supabase';
import type { BottleWithWineInfo } from './bottleService';
import * as tasteProfileService from './tasteProfileService';
import type { TasteProfile } from '../types/supabase';
import {
  fetchWineHistoryInsightsForWineIds,
  type WineHistoryInsight,
} from './historyService';
import { throwIfInsufficientCreditsResponse } from '../lib/insufficientCredits';

/** Optional — returned by Phase 2 agent; safe for older clients to ignore */
export interface AgentResponseMeta {
  eventId?: string;
  routedAction?: string;
  explanation?: unknown;
  actionResult?: 'ok' | 'error';
  /**
   * Server pipeline: deterministic_action, deterministic_inventory,
   * orchestrated_shortlist, legacy_full_cellar, conversational_response.
   */
  processingMode?:
    | 'deterministic_action'
    | 'deterministic_inventory'
    | 'orchestrated_shortlist'
    | 'legacy_full_cellar'
    | 'conversational_response';
  cellarAccess?: {
    scope?: string;
    cellarScannedFully?: boolean;
    listFullyDisplayed?: boolean;
    scannedBottleRows?: number;
    matchedBottleRows?: number;
    displayedBottleRows?: number;
    hasMore?: boolean;
    nextOffset?: number | null;
    hardFilters?: {
      colors?: string[];
      wantsKosher?: boolean;
      storageLocationHints?: string[];
      excludeReserved?: boolean;
    };
    dataGaps?: Record<string, number | undefined>;
    inventoryOffset?: number;
  };
}

export interface BuySuggestion {
  title: string;
  grape?: string;
  region?: string;
  color?: 'red' | 'white' | 'rosé' | 'sparkling';
  priceTier?: '$' | '$$' | '$$$' | '$$$$';
  reason: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** Ephemeral flag — greeting messages are regenerated when the tab regains focus */
  isGreeting?: boolean;
  /** Last turn metadata for action routing (open bottle, similar, etc.) */
  agentMeta?: AgentResponseMeta;
  recommendation?: {
    bottleId: string;
    reason: string;
    serveTemp?: string;
    decant?: string;
    alternatives?: Array<{ bottleId: string; reason: string }>;
  };
  bottleList?: {
    title?: string;
    bottles: Array<{
      bottleId: string;
      name: string;
      producer: string;
      vintage?: number | null;
      region?: string | null;
      rating?: number | null;
      readinessStatus?: string | null;
      serveTempC?: number | null;
      decantMinutes?: number | null;
      shortWhy: string;
    }>;
  };
  buySuggestions?: BuySuggestion[];
}

export interface AgentResponse {
  type?: 'single' | 'bottle_list' | 'buy_suggestions';
  message: string;
  title?: string;
  recommendation?: {
    bottleId: string;
    reason: string;
    serveTemp?: string;
    decant?: string;
    alternatives?: Array<{ bottleId: string; reason: string }>;
  };
  bottles?: Array<{
    bottleId: string;
    name: string;
    producer: string;
    vintage?: number | null;
    region?: string | null;
    rating?: number | null;
    readinessStatus?: string | null;
    serveTempC?: number | null;
    decantMinutes?: number | null;
    shortWhy: string;
  }>;
  suggestions?: BuySuggestion[];
  followUpQuestion?: string;
  /** Optional Phase 2 fields */
  agentMeta?: AgentResponseMeta;
}

/**
 * Send a message to the Cellar Agent
 * Returns AI-generated recommendation from user's cellar only
 */
export interface SendAgentMessageOptions {
  actionContext?: {
    lastEventId?: string;
    lastRecommendationBottleId?: string;
    anchorBottleId?: string;
    /** Phase 2B.1: scopes pending taste confirmations when present */
    conversationId?: string;
    /** Prior cellarAccess — retain hard filters on “show all” follow-ups */
    lastCellarAccess?: AgentResponseMeta['cellarAccess'];
  };
}

export async function sendAgentMessage(
  userMessage: string,
  conversationHistory: AgentMessage[],
  bottles: BottleWithWineInfo[],
  options?: SendAgentMessageOptions,
  language?: string
): Promise<AgentResponse> {
  // Get Supabase session for authentication
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated. Please log in again.');
  }

  const wineIds = [...new Set(bottles.map((b) => b.wine_id))];

  // Fetch history insights and taste profile in parallel — they are independent
  const [historyByWineId, tasteProfile] = await Promise.all([
    fetchWineHistoryInsightsForWineIds(wineIds).catch(() => undefined),
    tasteProfileService.getMyTasteProfile().catch(() => null),
  ]);

  const cellarContext = buildCellarContext(bottles, historyByWineId);
  const tasteContext = tasteProfile ? tasteProfileService.buildAgentContext(tasteProfile) : undefined;

  // Get API URL from environment variable, fallback to relative path for local dev
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const endpoint = apiUrl ? `${apiUrl}/api/agent/recommend` : '/api/agent/recommend';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`, // Pass Supabase token
    },
    credentials: 'include',
    body: JSON.stringify({
      message: userMessage,
      history: conversationHistory,
      cellarContext,
      tasteContext,
      actionContext: options?.actionContext,
      language,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throwIfInsufficientCreditsResponse(response.status, error);
    throw new Error(error.error || 'Failed to get recommendation');
  }

  const data = (await response.json()) as AgentResponse;
  if (import.meta.env.DEV) {
  }
  return data;
}

/**
 * Build compact cellar context for AI
 * Limits size to avoid token bloat
 */
function buildCellarContext(
  bottles: BottleWithWineInfo[],
  historyByWineId?: Map<string, WineHistoryInsight>
) {
  // Full in-stock list — server is source of truth; do not truncate.
  // History fields are merged server-side onto the authenticated cellar load.
  const bottlesToInclude = bottles;
  const totalPhysicalBottles = bottles.reduce((sum, b) => sum + b.quantity, 0);

  return {
    bottles: bottlesToInclude.map((b) => {
      const h = historyByWineId?.get(b.wine_id);
      const historyFields =
        h && h.openCount > 0
          ? {
              pastOpeningsCount: h.openCount,
              pastOpeningsAvgRating: h.avgRating ?? undefined,
              pastOpeningsRatingCount:
                (h.ratingCount ?? 0) > 0 ? h.ratingCount : undefined,
              pastNotesSummary: h.notesSummary ?? undefined,
            }
          : {};

      // Pull Hebrew translations if available (wines.translations.he)
      const heTranslations = (b.wine as any).translations?.he as
        | { wine_name?: string; producer?: string; region?: string }
        | undefined;

      return {
        id: b.id,
        producer: b.wine.producer,
        wineName: b.wine.wine_name,
        vintage: b.wine.vintage,
        region: b.wine.region,
        appellation: b.wine.appellation,
        country: b.wine.country,
        grapes: b.wine.grapes,
        color: b.wine.color,

        // Hebrew translations for cross-script search
        ...(heTranslations?.producer && { producerHe: heTranslations.producer }),
        ...(heTranslations?.wine_name && { wineNameHe: heTranslations.wine_name }),
        ...(heTranslations?.region && { regionHe: heTranslations.region }),

        // Keep / Reserve flag
        ...(b.is_reserved && { isReserved: true }),
        ...((b as any).reserved_for && { reservedFor: (b as any).reserved_for as string }),

        // Aging and readiness data
        drinkWindowStart: b.drink_window_start,
        drinkWindowEnd: b.drink_window_end,
        readinessStatus: b.readiness_status,
        readinessScore: b.readiness_score,

        // Serving recommendations
        serveTempC: b.serve_temp_c,
        decantMinutes: b.decant_minutes,

        // Analysis and notes
        analysisNotes: b.analysis_notes,
        notes: b.notes,

        // Bottle metadata
        quantity: b.quantity,
        purchaseDate: b.purchase_date,
        purchasePrice: b.purchase_price,
        ...((b as { purchase_price_currency?: string | null }).purchase_price_currency && {
          purchasePriceCurrency: (b as { purchase_price_currency?: string | null })
            .purchase_price_currency as string,
        }),
        ...(b.storage_location != null &&
          String(b.storage_location).trim() !== '' && {
            storageLocation: b.storage_location,
          }),

        // Vivino data for additional context
        vivinoRating: b.wine.vivino_rating,

        // Kosher status from DB enrichment pipeline (null = not yet enriched)
        ...((b.wine as any).is_kosher !== undefined && { isKosher: (b.wine as any).is_kosher as boolean | null }),
        ...((b.wine as any).kosher_confidence != null && { kosherConfidence: (b.wine as any).kosher_confidence as string }),

        ...historyFields,
      };
    }),
    summary: undefined,
    totalBottles: totalPhysicalBottles,
  };
}

/**
 * Transcribe audio using OpenAI Whisper API
 * Sends audio blob to server for transcription
 */
export async function transcribeAudio(audioBlob: Blob): Promise<{ text: string }> {
  // Get Supabase session for authentication
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated. Please log in again.');
  }

  // Get API URL from environment variable, fallback to relative path for local dev
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const endpoint = apiUrl ? `${apiUrl}/api/agent/transcribe` : '/api/agent/transcribe';

  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`, // Pass Supabase token
    },
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Transcription failed' }));
    throwIfInsufficientCreditsResponse(response.status, error);
    throw new Error(error.error || 'Failed to transcribe audio');
  }

  return response.json();
}

