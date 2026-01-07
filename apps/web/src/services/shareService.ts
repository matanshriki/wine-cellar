// Feedback iteration (dev only)
/**
 * Share Service (DEV ONLY)
 * 
 * Handles cellar sharing functionality for community-lite features.
 * Uses URL-based sharing without backend schema changes.
 */

import { supabase } from '../lib/supabase';
import type { BottleWithWineInfo } from './bottleService';

export interface ShareData {
  userId: string;
  userName: string;
  avatarUrl?: string;
  bottles: SimplifiedBottle[];
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

/**
 * Generate a shareable link for current user's cellar
 * Uses base64-encoded data in URL (dev-only, not secure)
 */
export async function generateShareLink(bottles: BottleWithWineInfo[]): Promise<{ link: string; userName: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

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
    totalBottles: simplifiedBottles.reduce((sum, b) => sum + b.quantity, 0),
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
    stats,
    createdAt: Date.now(),
  };

  // Compress and encode data
  const jsonString = JSON.stringify(shareData);
  const base64Data = btoa(jsonString);
  
  // Generate share URL
  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/share?data=${encodeURIComponent(base64Data)}`;
  
  console.log('[shareService] Generated share link:', {
    userName,
    bottleCount: simplifiedBottles.length,
    dataSize: jsonString.length,
    encodedSize: base64Data.length,
  });
  
  return {
    link: shareUrl,
    userName,
  };
}

/**
 * Parse shared cellar data from URL
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

