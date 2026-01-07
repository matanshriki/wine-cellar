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
  // Get auth session with refresh if needed
  let { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.log('[multiBottleService] No session, attempting refresh...');
    const { data: refreshData } = await supabase.auth.refreshSession();
    session = refreshData.session;
  }
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  console.log('[multiBottleService] Extracting multiple bottles from:', imageUrl);

  try {
    // Use direct fetch with explicit auth headers (same as labelParseService)
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-label-image`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        imageUrl: imageUrl,
        mode: 'multi-bottle',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[multiBottleService] Edge function error:', response.status, errorText);
      throw new Error(`AI extraction failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (!data || !data.success) {
      console.warn('[multiBottleService] Extraction failed');
      throw new Error('AI extraction returned no data');
    }

    // Check if we got multiple bottles from AI
    const bottles = data.bottles && Array.isArray(data.bottles) ? data.bottles : [];
    
    if (bottles.length === 0) {
      console.warn('[multiBottleService] No bottles detected in image');
      throw new Error('No bottles detected in the photo. Please ensure wine labels are clearly visible.');
    }
    
    console.log('[multiBottleService] ✅ Extracted', bottles.length, 'bottle(s):', bottles);
    
    // Map the bottles to our format
    const mappedBottles = bottles.map((b: any, index: number) => {
      // Calculate numeric confidence from field confidence levels
      const getFieldValue = (field: any) => field?.value || null;
      const getFieldConfidence = (field: any) => {
        if (!field || !field.confidence) return 0.5;
        const conf = field.confidence;
        return conf === 'high' ? 0.9 : conf === 'medium' ? 0.7 : 0.5;
      };
      
      const allConfidences = [
        getFieldConfidence(b.producer),
        getFieldConfidence(b.name),
        getFieldConfidence(b.vintage),
        getFieldConfidence(b.region),
        getFieldConfidence(b.style),
      ].filter(c => c > 0);
      
      const avgConfidence = allConfidences.length > 0
        ? allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length
        : 0.5;
      
      return {
        producer: getFieldValue(b.producer) || `Unknown Producer ${index + 1}`,
        wineName: getFieldValue(b.name) || `Wine ${index + 1}`,
        vintage: getFieldValue(b.vintage),
        region: getFieldValue(b.region),
        grapes: getFieldValue(b.grapes) ? (Array.isArray(getFieldValue(b.grapes)) ? getFieldValue(b.grapes).join(', ') : getFieldValue(b.grapes)) : undefined,
        color: getFieldValue(b.style) || 'red',
        confidence: avgConfidence,
        notes: undefined,
        source: 'multi-photo' as const,
      };
    });
    
    return {
      success: true,
      bottles: mappedBottles,
      imageUrl,
    };
  } catch (error: any) {
    console.error('[multiBottleService] Error:', error);
    throw error; // Don't fall back to mock data in production
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

