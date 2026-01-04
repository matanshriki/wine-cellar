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
    console.log('[Label Parse Service] ========== STARTING PARSE ==========');
    console.log('[Label Parse Service] Image URL:', imageUrl);
    console.log('[Label Parse Service] Image path:', imagePath);

    if (!imageUrl && !imagePath) {
      console.error('[Label Parse Service] ❌ No image URL or path provided');
      throw new Error('Either imageUrl or imagePath is required');
    }

    // Get auth token - try to refresh session if expired
    console.log('[Label Parse Service] Getting auth session...');
    let { data: { session } } = await supabase.auth.getSession();
    console.log('[Label Parse Service] Session:', session ? 'Found' : 'Not found');
    
    // If no session, try to refresh it (PWA session persistence)
    if (!session) {
      console.log('[Label Parse Service] No session found, attempting refresh...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('[Label Parse Service] ❌ Session refresh failed:', refreshError);
        throw new Error('Session expired. Please log in again.');
      }
      
      session = refreshData.session;
      console.log('[Label Parse Service] Session refreshed:', session ? 'Success' : 'Failed');
    }
    
    if (!session) {
      console.error('[Label Parse Service] ❌ Not authenticated after refresh attempt');
      throw new Error('Authentication required. Please log out and log in again.');
    }

    console.log('[Label Parse Service] User ID:', session.user.id);
    console.log('[Label Parse Service] Access token length:', session.access_token.length);

    // Call Edge Function
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-label-image`;
    console.log('[Label Parse Service] Function URL:', functionUrl);
    console.log('[Label Parse Service] Supabase URL from env:', import.meta.env.VITE_SUPABASE_URL);

    const requestBody = {
      imageUrl,
      imagePath,
    };
    console.log('[Label Parse Service] Request body:', JSON.stringify(requestBody, null, 2));

    console.log('[Label Parse Service] Sending fetch request...');
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[Label Parse Service] Response status:', response.status);
    console.log('[Label Parse Service] Response ok:', response.ok);
    console.log('[Label Parse Service] Response headers:', Array.from(response.headers.entries()));

    console.log('[Label Parse Service] Parsing response JSON...');
    const result = await response.json();
    console.log('[Label Parse Service] Response JSON:', JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error('[Label Parse Service] ❌ Error response');
      console.error('[Label Parse Service] Status:', response.status);
      console.error('[Label Parse Service] Result:', result);
      throw new Error(result.error || 'Failed to parse label');
    }

    console.log('[Label Parse Service] ✅ Success!');
    console.log('[Label Parse Service] Result:', result);
    console.log('[Label Parse Service] ========== PARSE COMPLETE ==========');
    return result;

  } catch (error: any) {
    console.error('[Label Parse Service] ========== PARSE ERROR ==========');
    console.error('[Label Parse Service] ❌ Error:', error);
    console.error('[Label Parse Service] Error message:', error.message);
    console.error('[Label Parse Service] Error name:', error.name);
    console.error('[Label Parse Service] Error stack:', error.stack);
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
  const formData = {
    wine_name: parsedData.name?.value || '',
    producer: parsedData.producer?.value || '',
    vintage: parsedData.vintage?.value?.toString() || '',
    region: parsedData.region?.value || '',
    grapes: parsedData.grapes?.value?.join(', ') || '',
    color: parsedData.style?.value || 'red',
    // Note: country, alcohol not currently in form but available if needed
  };
  
  console.log('[Label Parse Service] Converted form data:');
  console.log('[Label Parse Service] - wine_name:', formData.wine_name);
  console.log('[Label Parse Service] - producer:', formData.producer);
  console.log('[Label Parse Service] - vintage:', formData.vintage, '(from', parsedData.vintage?.value, ')');
  console.log('[Label Parse Service] - region:', formData.region, '(confidence:', parsedData.region?.confidence, ')');
  console.log('[Label Parse Service] - grapes:', formData.grapes);
  console.log('[Label Parse Service] - color:', formData.color);
  
  return formData;
}

/**
 * Get fields that were AI-extracted (for highlighting in UI)
 * 
 * @param parsedData - Parsed wine data from AI
 * @returns Object with field names that have values
 */
export function getExtractedFields(parsedData: ParsedWineData): string[] {
  const extracted: string[] = [];
  
  if (parsedData.producer?.value) {
    extracted.push('producer');
    console.log('[Label Parse Service] ✓ Extracted: producer =', parsedData.producer.value);
  }
  if (parsedData.name?.value) {
    extracted.push('wine_name');
    console.log('[Label Parse Service] ✓ Extracted: wine_name =', parsedData.name.value);
  }
  if (parsedData.vintage?.value) {
    extracted.push('vintage');
    console.log('[Label Parse Service] ✓ Extracted: vintage =', parsedData.vintage.value);
  }
  if (parsedData.region?.value) {
    extracted.push('region');
    console.log('[Label Parse Service] ✓ Extracted: region =', parsedData.region.value);
  }
  if (parsedData.grapes?.value) {
    extracted.push('grapes');
    console.log('[Label Parse Service] ✓ Extracted: grapes =', parsedData.grapes.value.join(', '));
  }
  if (parsedData.style?.value) {
    extracted.push('color');
    console.log('[Label Parse Service] ✓ Extracted: color =', parsedData.style.value);
  }
  
  console.log('[Label Parse Service] Total extracted fields:', extracted.length, '-', extracted.join(', '));
  
  return extracted;
}

