/**
 * Cellar Sommelier Service (Production)
 * 
 * Client-side service for communicating with the Cellar Sommelier API.
 * Access is controlled by feature flags (cellar_agent_enabled).
 */

import { supabase } from '../lib/supabase';
import type { BottleWithWineInfo } from './bottleService';

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  recommendation?: {
    bottleId: string;
    reason: string;
    serveTemp?: string;
    decant?: string;
    alternatives?: Array<{ bottleId: string; reason: string }>;
  };
}

export interface AgentResponse {
  message: string;
  recommendation?: {
    bottleId: string;
    reason: string;
    serveTemp?: string;
    decant?: string;
    alternatives?: Array<{ bottleId: string; reason: string }>;
  };
  followUpQuestion?: string;
}

/**
 * Send a message to the Cellar Agent
 * Returns AI-generated recommendation from user's cellar only
 */
export async function sendAgentMessage(
  userMessage: string,
  conversationHistory: AgentMessage[],
  bottles: BottleWithWineInfo[]
): Promise<AgentResponse> {
  // Get Supabase session for authentication
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated. Please log in again.');
  }

  // Build compact cellar context
  const cellarContext = buildCellarContext(bottles);

  const response = await fetch('/api/agent/recommend', {
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
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to get recommendation');
  }

  return response.json();
}

/**
 * Build compact cellar context for AI
 * Limits size to avoid token bloat
 */
function buildCellarContext(bottles: BottleWithWineInfo[]) {
  // If too many bottles, keep best 60 for recommendations
  let bottlesToInclude = bottles;
  let summary = '';

  if (bottles.length > 60) {
    // Prefer bottles that are ready now + recent additions
    const readyBottles = bottles.filter(
      (b) => b.readiness_status === 'ready' || b.readiness_status === 'peak'
    );
    const recentBottles = bottles
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 30);

    // Combine and dedupe
    const combined = [...readyBottles, ...recentBottles];
    const unique = Array.from(new Set(combined.map((b) => b.id))).map((id) =>
      combined.find((b) => b.id === id)!
    );

    bottlesToInclude = unique.slice(0, 60);

    // Build summary
    const colorCounts = countByProperty(bottles, (b) => b.wine.color);
    const regionCounts = countByProperty(bottles, (b) => b.wine.region || 'Unknown');
    const vintages = bottles
      .map((b) => b.wine.vintage)
      .filter((v): v is number => v !== null)
      .sort();
    const minVintage = vintages[0];
    const maxVintage = vintages[vintages.length - 1];

    summary = `Total cellar: ${bottles.length} bottles. Colors: ${formatCounts(colorCounts)}. Regions: ${formatCounts(regionCounts, 5)}. Vintages: ${minVintage}-${maxVintage}.`;
  }

  return {
    bottles: bottlesToInclude.map((b) => ({
      id: b.id,
      producer: b.wine.producer,
      wineName: b.wine.wine_name,
      vintage: b.wine.vintage,
      region: b.wine.region,
      country: b.wine.country,
      grapes: b.wine.grapes,
      color: b.wine.color,
      drinkWindowStart: b.drink_window_start,
      drinkWindowEnd: b.drink_window_end,
      readinessStatus: b.readiness_status,
      notes: b.notes,
      quantity: b.quantity,
    })),
    summary: summary || undefined,
    totalBottles: bottles.length,
  };
}

/**
 * Helper: Count by property
 */
function countByProperty<T>(
  items: T[],
  keyFn: (item: T) => string
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/**
 * Helper: Format counts for summary
 */
function formatCounts(counts: Record<string, number>, limit = 3): string {
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  return entries.map(([key, count]) => `${key} (${count})`).join(', ');
}

