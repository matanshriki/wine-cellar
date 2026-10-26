// Feedback iteration (dev only)
/**
 * Share Service
 * 
 * Handles cellar sharing functionality with database-backed short links.
 * Stores share data in Supabase for reliable, short URLs.
 */

import { supabase } from '../lib/supabase';
import { safeGetItem } from '../utils/safeLocalStorage';
import type { BottleWithWineInfo } from './bottleService';
import { sumInStockBottles } from '../utils/inventory';

export interface ShareData {
  userId: string;
  userName: string;
  avatarUrl?: string;
  bottles: SimplifiedBottle[];
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  stats: {
    totalBottles: number;
    redCount: number;
    whiteCount: number;
    roseCount: number;
    sparklingCount: number;
    topRegions: string[];
  };
  createdAt: number;
}

export interface SimplifiedBottle {
  id: string;
  wineName: string;
  producer: string;
  vintage?: number;
  region?: string;
  color: string;
  quantity: number;
  rating?: number;
}

/** Share links expire after 7 days (matches product copy). */
const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SharedCellarLoadError = 'expired' | 'not_found' | 'invalid' | 'failed';

export type SharedCellarLoadResult =
  | { ok: true; data: ShareData }
  | { ok: false; reason: SharedCellarLoadError };

/**
 * Generate a short, random ID for share links
 * Uses URL-safe characters (a-z, A-Z, 0-9)
 */
function generateShareId(length: number = 7): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function isValidShareData(data: unknown): data is ShareData {
  if (!data || typeof data !== 'object') return false;
  const d = data as ShareData;
  return (
    typeof d.userId === 'string' &&
    typeof d.userName === 'string' &&
    Array.isArray(d.bottles)
  );
}

function edgeFunctionUrl(name: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL ?? '';
  return `${base}/functions/v1/${name}`;
}

function anonHeaders(): Record<string, string> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  return {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
}

/**
 * Generate a shareable link for current user's cellar
 * Stores data in database and returns a short link
 */
export async function generateShareLink(bottles: BottleWithWineInfo[]): Promise<{ link: string; userName: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Get user's current sort preference from localStorage
  const rawDir = safeGetItem('cellar-sort-dir');
  const sortBy = safeGetItem('cellar-sort-by') || 'createdAt';
  const sortDir: 'asc' | 'desc' = rawDir === 'asc' || rawDir === 'desc' ? rawDir : 'desc';

  // Get user profile for display name (with error handling)
  let userName = 'Wine Enthusiast';
  let avatarUrl: string | undefined = undefined;
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('display_name, first_name, last_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (!error && profile) {
      // Priority: display_name > first_name + last_name > email username
      userName = profile.display_name 
        || (profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : null)
        || profile.first_name
        || 'Wine Enthusiast';
      
      // Get avatar URL if available
      avatarUrl = profile.avatar_url || undefined;
    } else {
      console.error('[shareService] Profile query error:', error);
      // Fallback to email username if profile doesn't exist or has no name
      const emailUsername = user.email?.split('@')[0] || 'Wine Enthusiast';
      userName = emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
    }
  } catch (error) {
    // Profile might not exist yet - use email username as fallback
    console.error('[shareService] Profile not found, using email as fallback:', error);
    const emailUsername = user.email?.split('@')[0] || 'Wine Enthusiast';
    userName = emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
  }

  // Simplify bottles data for sharing (remove sensitive info)
  const simplifiedBottles: SimplifiedBottle[] = bottles
    .filter(b => b.quantity > 0)
    .map(b => ({
      id: b.id,
      wineName: b.wine.wine_name,
      producer: b.wine.producer || 'Unknown',
      vintage: b.wine.vintage || undefined,
      region: b.wine.region || undefined,
      color: b.wine.color,
      quantity: b.quantity,
      rating: (b.wine as any).rating || undefined,
    }));

  // Calculate stats
  const stats = {
    totalBottles: sumInStockBottles(simplifiedBottles),
    redCount: simplifiedBottles.filter(b => b.color === 'red').length,
    whiteCount: simplifiedBottles.filter(b => b.color === 'white').length,
    roseCount: simplifiedBottles.filter(b => b.color === 'rose').length,
    sparklingCount: simplifiedBottles.filter(b => b.color === 'sparkling').length,
    topRegions: getTopRegions(simplifiedBottles),
  };

  const shareData: ShareData = {
    userId: user.id,
    userName,
    avatarUrl,
    bottles: simplifiedBottles,
    sortBy,
    sortDir,
    stats,
    createdAt: Date.now(),
  };

  // Generate a unique short ID (retry if collision)
  let shareId: string | undefined;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    shareId = generateShareId(7);

    const { data: existing } = await supabase
      .from('shared_cellars')
      .select('id')
      .eq('id', shareId)
      .maybeSingle();

    if (!existing) {
      break;
    }

    attempts++;
  }

  if (!shareId || attempts === maxAttempts) {
    throw new Error('Failed to generate unique share ID');
  }

  const expiresAt = new Date(Date.now() + SHARE_TTL_MS).toISOString();

  const { error: insertError } = await supabase
    .from('shared_cellars')
    .insert({
      id: shareId,
      user_id: user.id,
      share_data: shareData,
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error('[shareService] Failed to store share data:', insertError);
    throw new Error('Failed to create share link');
  }

  // Confirm the row is readable for the creator before handing out the URL
  const { data: verified, error: verifyError } = await supabase
    .from('shared_cellars')
    .select('id, expires_at')
    .eq('id', shareId)
    .maybeSingle();

  if (verifyError || !verified) {
    console.error('[shareService] Share created but not readable:', verifyError);
    throw new Error('Share link was created but could not be verified. Check shared_cellars RLS policies.');
  }

  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/share/${shareId}`;

  console.log('[shareService] Generated short share link:', {
    shareId,
    userName,
    bottleCount: simplifiedBottles.length,
    expiresAt,
    linkLength: shareUrl.length,
  });

  return {
    link: shareUrl,
    userName,
  };
}

/**
 * Fetch shared cellar via public edge function (preferred), with direct DB fallback.
 */
export async function loadSharedCellar(shareId: string): Promise<SharedCellarLoadResult> {
  console.log('[shareService] Loading shared cellar:', shareId);

  try {
    const url = `${edgeFunctionUrl('shared-cellar-get')}?id=${encodeURIComponent(shareId)}`;
    const res = await fetch(url, { headers: anonHeaders() });

    if (res.ok) {
      const body = (await res.json()) as { share_data?: unknown };
      if (!isValidShareData(body.share_data)) {
        return { ok: false, reason: 'invalid' };
      }
      return { ok: true, data: body.share_data };
    }

    if (res.status === 410) {
      return { ok: false, reason: 'expired' };
    }
    if (res.status === 404) {
      return { ok: false, reason: 'not_found' };
    }
    if (res.status === 422) {
      return { ok: false, reason: 'invalid' };
    }

    // Function missing / auth / other — fall through to direct read
    console.warn('[shareService] Edge fetch failed, falling back to DB:', res.status);
  } catch (err) {
    console.warn('[shareService] Edge fetch error, falling back to DB:', err);
  }

  return getSharedCellarFromDb(shareId);
}

/** @deprecated Prefer loadSharedCellar for typed errors */
export async function getSharedCellar(shareId: string): Promise<ShareData | null> {
  const result = await loadSharedCellar(shareId);
  return result.ok ? result.data : null;
}

async function getSharedCellarFromDb(shareId: string): Promise<SharedCellarLoadResult> {
  try {
    const { data, error } = await supabase
      .from('shared_cellars')
      .select('share_data, expires_at, view_count')
      .eq('id', shareId)
      .maybeSingle();

    if (error) {
      console.error('[shareService] Failed to fetch shared cellar:', error);
      return { ok: false, reason: 'failed' };
    }

    if (!data) {
      return { ok: false, reason: 'not_found' };
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      console.warn('[shareService] Shared cellar expired:', data.expires_at);
      return { ok: false, reason: 'expired' };
    }

    if (!isValidShareData(data.share_data)) {
      console.error('[shareService] Invalid share data structure');
      return { ok: false, reason: 'invalid' };
    }

    void supabase
      .from('shared_cellars')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', shareId);

    return { ok: true, data: data.share_data };
  } catch (error) {
    console.error('[shareService] Failed to get shared cellar:', error);
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Parse shared cellar data from URL (DEPRECATED - kept for backwards compatibility)
 * Old links with ?data=... will still work
 */
export function parseShareLink(encodedData: string): ShareData | null {
  try {
    const base64Data = decodeURIComponent(encodedData);
    const jsonString = atob(base64Data);
    const data = JSON.parse(jsonString) as ShareData;
    
    // Validate data structure
    if (!data.userId || !data.userName || !Array.isArray(data.bottles)) {
      console.error('[shareService] Invalid share data structure');
      return null;
    }
    
    // Check if data is too old (7 days)
    const age = Date.now() - (data.createdAt || 0);
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    if (age > maxAge) {
      console.warn('[shareService] Share link expired (older than 7 days)');
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('[shareService] Failed to parse share link:', error);
    return null;
  }
}

/**
 * Get top regions from bottles
 */
function getTopRegions(bottles: SimplifiedBottle[]): string[] {
  const regionCounts = bottles
    .filter(b => b.region)
    .reduce((acc, b) => {
      const region = b.region!;
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return Object.entries(regionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([region]) => region);
}

/**
 * Generate mock shared cellars for community page (dev only)
 */
export function generateMockSharedCellars(): ShareData[] {
  return [
    {
      userId: 'mock-user-1',
      userName: 'Alexandre B.',
      bottles: [
        {
          id: '1',
          wineName: 'Château Margaux',
          producer: 'Château Margaux',
          vintage: 2015,
          region: 'Bordeaux',
          color: 'red',
          quantity: 2,
          rating: 4.5,
        },
        {
          id: '2',
          wineName: 'Chablis Grand Cru',
          producer: 'Domaine Raveneau',
          vintage: 2019,
          region: 'Burgundy',
          color: 'white',
          quantity: 3,
          rating: 4.7,
        },
      ],
      stats: {
        totalBottles: 5,
        redCount: 2,
        whiteCount: 3,
        roseCount: 0,
        sparklingCount: 0,
        topRegions: ['Bordeaux', 'Burgundy'],
      },
      createdAt: Date.now(),
    },
    {
      userId: 'mock-user-2',
      userName: 'Sarah M.',
      bottles: [
        {
          id: '3',
          wineName: 'Barolo Riserva',
          producer: 'Giacomo Conterno',
          vintage: 2016,
          region: 'Piedmont',
          color: 'red',
          quantity: 1,
          rating: 4.8,
        },
        {
          id: '4',
          wineName: 'Champagne Brut',
          producer: 'Dom Pérignon',
          vintage: 2012,
          region: 'Champagne',
          color: 'sparkling',
          quantity: 2,
          rating: 4.6,
        },
      ],
      stats: {
        totalBottles: 3,
        redCount: 1,
        whiteCount: 0,
        roseCount: 0,
        sparklingCount: 2,
        topRegions: ['Piedmont', 'Champagne'],
      },
      createdAt: Date.now(),
    },
    {
      userId: 'mock-user-3',
      userName: 'Thomas K.',
      bottles: [
        {
          id: '5',
          wineName: 'Rioja Gran Reserva',
          producer: 'López de Heredia',
          vintage: 2010,
          region: 'Rioja',
          color: 'red',
          quantity: 3,
          rating: 4.4,
        },
      ],
      stats: {
        totalBottles: 3,
        redCount: 3,
        whiteCount: 0,
        roseCount: 0,
        sparklingCount: 0,
        topRegions: ['Rioja'],
      },
      createdAt: Date.now(),
    },
  ];
}

