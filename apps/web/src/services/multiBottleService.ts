// Feedback iteration (dev only)
/**
 * Multi-Bottle Import Service (DEV ONLY)
 * 
 * Handles extraction of multiple bottles from a single photo.
 * This is a prototype for testing UX before production implementation.
 */

import { supabase } from '../lib/supabase';
import { uploadLabelImage } from './labelScanService';

export interface ExtractedBottleData {
  producer: string;
  wineName: string;
  vintage?: number;
  region?: string;
  grapes?: string;
  color: 'red' | 'white' | 'rose' | 'sparkling';
  confidence: number; // 0-1
  notes?: string;
  source: 'multi-photo';
}

export interface MultiBottleExtractionResult {
  success: boolean;
  bottles: ExtractedBottleData[];
  imageUrl: string;
  error?: string;
}

/**
 * Extract multiple bottles from a single photo using AI
 * Uses OpenAI GPT-4 Vision to detect and extract bottle details
 */
export async function extractMultipleBottlesFromImage(
  imageUrl: string
): Promise<MultiBottleExtractionResult> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  console.log('[multiBottleService] Extracting multiple bottles from:', imageUrl);

  try {
    // Call Supabase Edge Function for multi-bottle extraction
    const { data, error } = await supabase.functions.invoke('extract-multi-bottles', {
      body: {
        image_url: imageUrl,
      },
    });

    if (error) {
      console.error('[multiBottleService] Edge function error:', error);
      
      // Fallback: Return mock data for dev testing
      return createMockMultiBottleResult(imageUrl);
    }

    if (!data || !data.success) {
      console.warn('[multiBottleService] Extraction failed, using mock data');
      return createMockMultiBottleResult(imageUrl);
    }

    console.log('[multiBottleService] ✅ Extracted bottles:', data.bottles);
    
    return {
      success: true,
      bottles: data.bottles.map((b: any) => ({
        producer: b.producer || '',
        wineName: b.wine_name || b.wineName || '',
        vintage: b.vintage,
        region: b.region,
        grapes: b.grapes || b.grape,
        color: b.color || b.wine_color || 'red',
        confidence: b.confidence || 0.5,
        notes: b.notes,
        source: 'multi-photo',
      })),
      imageUrl,
    };
  } catch (error: any) {
    console.error('[multiBottleService] Error:', error);
    
    // Return mock data for dev testing
    return createMockMultiBottleResult(imageUrl);
  }
}

/**
 * Create mock multi-bottle result for dev testing
 * Simulates AI detection of multiple bottles
 */
function createMockMultiBottleResult(imageUrl: string): MultiBottleExtractionResult {
  console.log('[multiBottleService] 🧪 Using mock data for dev testing');
  
  return {
    success: true,
    imageUrl,
    bottles: [
      {
        producer: 'Château Example',
        wineName: 'Grand Reserve',
        vintage: 2018,
        region: 'Bordeaux',
        grapes: 'Cabernet Sauvignon, Merlot',
        color: 'red',
        confidence: 0.85,
        notes: 'Mock bottle 1 (dev only)',
        source: 'multi-photo',
      },
      {
        producer: 'Domaine Test',
        wineName: 'Blanc de Blancs',
        vintage: 2020,
        region: 'Burgundy',
        grapes: 'Chardonnay',
        color: 'white',
        confidence: 0.78,
        notes: 'Mock bottle 2 (dev only)',
        source: 'multi-photo',
      },
      {
        producer: 'Bodega Sample',
        wineName: 'Reserva Especial',
        vintage: 2019,
        region: 'Rioja',
        grapes: 'Tempranillo',
        color: 'red',
        confidence: 0.72,
        notes: 'Mock bottle 3 (dev only)',
        source: 'multi-photo',
      },
    ],
  };
}

/**
 * Upload and extract multiple bottles from a photo
 */
export async function scanMultipleBottles(file: File): Promise<MultiBottleExtractionResult> {
  console.log('[multiBottleService] Starting multi-bottle scan');
  
  // 1. Upload image
  const imageUrl = await uploadLabelImage(file);
  console.log('[multiBottleService] Image uploaded:', imageUrl);
  
  // 2. Extract multiple bottles
  const result = await extractMultipleBottlesFromImage(imageUrl);
  console.log('[multiBottleService] Extraction complete:', result);
  
  return result;
}

/**
 * Check if a bottle might be a duplicate in the cellar
 */
export function checkForDuplicate(
  bottle: ExtractedBottleData,
  existingBottles: any[]
): boolean {
  return existingBottles.some((existing) => {
    const matchProducer = 
      existing.wine?.producer?.toLowerCase() === bottle.producer.toLowerCase();
    const matchName = 
      existing.wine?.wine_name?.toLowerCase() === bottle.wineName.toLowerCase();
    const matchVintage = 
      existing.wine?.vintage === bottle.vintage;
    
    return matchProducer && matchName && matchVintage;
  });
}

