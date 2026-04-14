/**
 * Label Parse Service
 * 
 * Extracts wine data from bottle label images using OCR + AI
 */

import { supabase } from '../lib/supabase';
import {
  InsufficientCreditsError,
  isInsufficientCreditsError,
} from '../lib/insufficientCredits';

export interface ParsedWineField<T> {
  value: T;
  confidence: 'low' | 'medium' | 'high';
}

export interface ParsedWineData {
  producer: ParsedWineField<string> | null;
  name: ParsedWineField<string> | null;
  vintage: ParsedWineField<number> | null;
  region: ParsedWineField<string> | null;
  country: ParsedWineField<string> | null;
  style: ParsedWineField<'red' | 'white' | 'rose' | 'sparkling'> | null;
  grapes: ParsedWineField<string[]> | null;
  alcohol: ParsedWineField<number> | null;
}

export interface ParseLabelResult {
  success: boolean;
  data?: ParsedWineData;
  overallConfidence?: 'low' | 'medium' | 'high';
  fieldsExtracted?: number;
  error?: string;
}

/**
 * Parse wine label from image
 * 
 * @param imageUrl - Public URL of the uploaded image
 * @param imagePath - Storage path (alternative to imageUrl)
 * @returns Parsed wine data or error
 */
export async function parseLabelImage(
  imageUrl?: string,
  imagePath?: string
): Promise<ParseLabelResult> {
  try {
    if (!imageUrl && !imagePath) {
      throw new Error('Either imageUrl or imagePath is required');
    }

    // Get auth token - try to refresh session if expired
    let { data: { session } } = await supabase.auth.getSession();

    // If no session, try to refresh it (PWA session persistence)
    if (!session) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw new Error('Session expired. Please log in again.');
      session = refreshData.session;
    }

    if (!session) throw new Error('Authentication required. Please log out and log in again.');

    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-label-image`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ imageUrl, imagePath }),
    });

    const result = await response.json();

    if (!response.ok) {
      if (
        response.status === 402 ||
        (result as { error?: string })?.error === 'insufficient_credits'
      ) {
        const r = result as {
          message?: string;
          required?: number;
          effectiveBalance?: number;
        };
        throw new InsufficientCreditsError(
          typeof r.message === 'string' ? r.message : undefined,
          {
            requiredCredits: typeof r.required === 'number' ? r.required : undefined,
            balance: typeof r.effectiveBalance === 'number' ? r.effectiveBalance : undefined,
          },
        );
      }
      throw new Error((result as { error?: string }).error || 'Failed to parse label');
    }

    return result;

  } catch (error: any) {
    if (isInsufficientCreditsError(error)) {
      throw error;
    }
    console.error('[LabelParseService] Error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to parse label image',
    };
  }
}

/**
 * Convert parsed data to form data format
 */
export function convertParsedDataToFormData(parsedData: ParsedWineData) {
  return {
    wine_name: parsedData.name?.value || '',
    producer: parsedData.producer?.value || '',
    vintage: parsedData.vintage?.value?.toString() || '',
    region: parsedData.region?.value || '',
    grapes: parsedData.grapes?.value?.join(', ') || '',
    color: parsedData.style?.value || 'red',
  };
}

/**
 * Get fields that were AI-extracted (for highlighting in UI)
 */
export function getExtractedFields(parsedData: ParsedWineData): string[] {
  const extracted: string[] = [];
  if (parsedData.producer?.value) extracted.push('producer');
  if (parsedData.name?.value) extracted.push('wine_name');
  if (parsedData.vintage?.value) extracted.push('vintage');
  if (parsedData.region?.value) extracted.push('region');
  if (parsedData.grapes?.value) extracted.push('grapes');
  if (parsedData.style?.value) extracted.push('color');
  return extracted;
}
