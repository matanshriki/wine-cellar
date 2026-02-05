/**
 * Evening Plan Service
 * 
 * Manages persistent evening plans:
 * - Create/update/complete plans
 * - Save queue and progress
 * - Resume active plans
 * - Store completion data
 */

import { supabase } from '../lib/supabase';
import type { BottleWithWineInfo } from './bottleService';

export interface QueuedWine {
  wine_id: string;
  bottle_id: string;
  position: number;
  wine_name: string;
  producer: string;
  vintage: number | null;
  color: string;
  rating: number | null;
  image_url: string | null;
  // Completion data
  opened?: boolean;
  opened_quantity?: number;
  user_rating?: number | null;
  notes?: string;
}

export interface EveningPlan {
  id: string;
  user_id: string;
  status: 'active' | 'completed' | 'cancelled';
  plan_name: string | null;
  occasion: string | null;
  group_size: string | null;
  settings: Record<string, any>;
  queue: QueuedWine[];
  now_playing_index: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  total_bottles_opened: number;
  average_rating: number | null;
}

/**
 * Get the active plan for the current user
 */
export async function getActivePlan(): Promise<EveningPlan | null> {
  console.log('[EveningPlanService] Fetching active plan...');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[EveningPlanService] No authenticated user');
    return null;
  }

  const { data, error } = await supabase
    .from('evening_plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No active plan found
      console.log('[EveningPlanService] No active plan');
      return null;
    }
    console.error('[EveningPlanService] Error fetching plan:', error);
    return null;
  }

  console.log('[EveningPlanService] ✅ Active plan found:', data.id);
  return data as EveningPlan;
}

/**
 * Create a new evening plan
 */
export async function createPlan(params: {
  occasion: string;
  group_size: string;
  settings: Record<string, any>;
  queue: QueuedWine[];
}): Promise<EveningPlan> {
  console.log('[EveningPlanService] Creating new plan...');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Cancel any existing active plans first
  await supabase
    .from('evening_plans')
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)
    .eq('status', 'active');

  const { data, error } = await supabase
    .from('evening_plans')
    .insert({
      user_id: user.id,
      status: 'active',
      occasion: params.occasion,
      group_size: params.group_size,
      settings: params.settings,
      queue: params.queue,
      now_playing_index: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[EveningPlanService] Error creating plan:', error);
    throw error;
  }

  console.log('[EveningPlanService] ✅ Plan created:', data.id);
  return data as EveningPlan;
}

/**
 * Update plan progress (now playing index)
 */
export async function updateProgress(planId: string, nowPlayingIndex: number): Promise<void> {
  console.log('[EveningPlanService] Updating progress:', nowPlayingIndex);
  
  const { error } = await supabase
    .from('evening_plans')
    .update({ now_playing_index: nowPlayingIndex })
    .eq('id', planId);

  if (error) {
    console.error('[EveningPlanService] Error updating progress:', error);
    throw error;
  }

  console.log('[EveningPlanService] ✅ Progress updated');
}

/**
 * Update queue (for swaps, completions, etc)
 */
export async function updateQueue(planId: string, queue: QueuedWine[]): Promise<void> {
  console.log('[EveningPlanService] Updating queue...');
  
  const { error } = await supabase
    .from('evening_plans')
    .update({ queue })
    .eq('id', planId);

  if (error) {
    console.error('[EveningPlanService] Error updating queue:', error);
    throw error;
  }

  console.log('[EveningPlanService] ✅ Queue updated');
}

/**
 * Complete the plan
 */
export async function completePlan(planId: string, completionData: {
  queue: QueuedWine[];
  total_bottles_opened: number;
  average_rating: number | null;
}): Promise<void> {
  console.log('[EveningPlanService] Completing plan...');
  
  const { error } = await supabase
    .from('evening_plans')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      queue: completionData.queue,
      total_bottles_opened: completionData.total_bottles_opened,
      average_rating: completionData.average_rating,
    })
    .eq('id', planId);

  if (error) {
    console.error('[EveningPlanService] Error completing plan:', error);
    throw error;
  }

  console.log('[EveningPlanService] ✅ Plan completed');
}

/**
 * Cancel the plan
 */
export async function cancelPlan(planId: string): Promise<void> {
  console.log('[EveningPlanService] Cancelling plan...');
  
  const { error } = await supabase
    .from('evening_plans')
    .update({ status: 'cancelled' })
    .eq('id', planId);

  if (error) {
    console.error('[EveningPlanService] Error cancelling plan:', error);
    throw error;
  }

  console.log('[EveningPlanService] ✅ Plan cancelled');
}

/**
 * Get completed plans for history
 */
export async function getCompletedPlans(): Promise<EveningPlan[]> {
  console.log('[EveningPlanService] Fetching completed plans...');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('evening_plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (error) {
    console.error('[EveningPlanService] Error fetching completed plans:', error);
    return [];
  }

  console.log('[EveningPlanService] ✅ Found', data.length, 'completed plans');
  return data as EveningPlan[];
}

/**
 * Convert lineup to queued wines format
 */
export function lineupToQueue(lineup: Array<{
  bottle: BottleWithWineInfo;
  position: number;
  label: string;
}>): QueuedWine[] {
  return lineup.map((slot) => ({
    wine_id: slot.bottle.wine_id,
    bottle_id: slot.bottle.id,
    position: slot.position,
    wine_name: slot.bottle.wine.wine_name,
    producer: slot.bottle.wine.producer || '',
    vintage: slot.bottle.wine.vintage,
    color: slot.bottle.wine.color,
    rating: slot.bottle.wine.rating,
    image_url: slot.bottle.wine.image_url || null,
    opened: false,
    opened_quantity: 0,
    user_rating: null,
    notes: undefined,
  }));
}
