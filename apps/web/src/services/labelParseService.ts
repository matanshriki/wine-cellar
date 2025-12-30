/**
 * Label Parse Service
 * 
 * Extracts wine data from bottle label images using OCR + AI
 */

import { supabase } from '../lib/supabase';

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
    console.log('[Label Parse Service] Starting label parse...');
    console.log('[Label Parse Service] Image URL:', imageUrl);
    console.log('[Label Parse Service] Image path:', imagePath);

    if (!imageUrl && !imagePath) {
      throw new Error('Either imageUrl or imagePath is required');
    }

    // Get auth token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Call Edge Function
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-label-image`;
    
    console.log('[Label Parse Service] Calling Edge Function:', functionUrl);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        imageUrl,
        imagePath,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Label Parse Service] Error response:', result);
      throw new Error(result.error || 'Failed to parse label');
    }

    console.log('[Label Parse Service] ✅ Success!', result);
    return result;

  } catch (error: any) {
    console.error('[Label Parse Service] ❌ Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to parse label image',
    };
  }
}

/**
 * Convert parsed data to form data format
 * 
 * @param parsedData - Parsed wine data from AI
 * @returns Form-compatible data object
 */
export function convertParsedDataToFormData(parsedData: ParsedWineData) {
  return {
    wine_name: parsedData.name?.value || '',
    producer: parsedData.producer?.value || '',
    vintage: parsedData.vintage?.value?.toString() || '',
    region: parsedData.region?.value || '',
    grapes: parsedData.grapes?.value?.join(', ') || '',
    color: parsedData.style?.value || 'red',
    // Note: country, alcohol not currently in form but available if needed
  };
}

/**
 * Get fields that were AI-extracted (for highlighting in UI)
 * 
 * @param parsedData - Parsed wine data from AI
 * @returns Object with field names that have values
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

