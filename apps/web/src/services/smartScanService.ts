/**
 * Smart Scan Service
 * 
 * Unified bottle detection that automatically determines if a photo contains
 * a single bottle or multiple bottles, then routes to the appropriate confirmation flow.
 * 
 * Reuses existing AI infrastructure (parse-label-image edge function)
 */

import { supabase } from '../lib/supabase';
import { uploadLabelImage } from './labelScanService';
import type { ExtractedWineData } from './labelScanService';
import type { ExtractedBottleData } from './multiBottleService';

export type ScanMode = 'single' | 'multi' | 'receipt' | 'unknown';

export interface SmartScanResult {
  mode: ScanMode;
  imageUrl: string;  // Temporary URL for immediate display
  imagePath?: string;  // NEW: Stable storage path
  imageBucket?: string;  // NEW: Storage bucket name
  // Single bottle result
  singleBottle?: {
    extractedData: ExtractedWineData;
  };
  // Multiple bottles result
  multipleBottles?: {
    bottles: ExtractedBottleData[];
  };
  // Receipt result
  receiptItems?: any[];
  // Metadata
  detectedCount: number;
  confidence: number;
}

/**
 * Perform smart scan: automatically detect if image contains single or multiple bottles
 * 
 * @param file - Image file to scan
 * @returns SmartScanResult with mode (single/multi) and appropriate data
 */
export async function performSmartScan(file: File): Promise<SmartScanResult> {
  console.log('[smartScanService] ========== SMART SCAN START ==========');
  console.log('[smartScanService] File:', file.name, file.size, 'bytes', file.type);

  try {
    // 1. Upload image (returns stable path)
    console.log('[smartScanService] Step 1: Uploading image...');
    const { path, bucket } = await uploadLabelImage(file);
    console.log('[smartScanService] ✅ Image uploaded, path:', path);

    // 2. Generate temporary signed URL for Edge Function
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 600); // 10 minutes

    if (signedError) {
      console.error('[smartScanService] Failed to create signed URL:', signedError);
      throw new Error('Failed to generate image URL for processing');
    }

    const tempImageUrl = signedUrlData.signedUrl;
    console.log('[smartScanService] Created temporary URL for AI processing');

    // 3. Call AI with multi-bottle mode (always returns array, which we then analyze)
    console.log('[smartScanService] Step 2: Calling edge function...');
    console.log('[smartScanService] Request params:', { imageUrl: tempImageUrl, mode: 'multi-bottle' });
    
    const { data, error } = await supabase.functions.invoke('parse-label-image', {
      body: {
        imageUrl: tempImageUrl,
        mode: 'multi-bottle', // Always use multi-bottle mode to get array response
      },
    });

    console.log('[smartScanService] Edge function response received');
    console.log('[smartScanService] Error:', error);
    console.log('[smartScanService] Data:', data);

    if (error) {
      console.error('[smartScanService] ❌ Edge function error:', error);
      throw new Error(`AI extraction failed: ${error.message}`);
    }

    if (!data) {
      console.warn('[smartScanService] ⚠️ No data returned from edge function');
      console.warn('[smartScanService] Falling back to single mode with empty data');
      return {
        mode: 'single',
        imageUrl: tempImageUrl,
        imagePath: path,
        imageBucket: bucket,
        singleBottle: {
          extractedData: createEmptyExtractedData(path, bucket),
        },
        detectedCount: 0,
        confidence: 0,
      };
    }

    const imageType = data.image_type || 'label';
    console.log('[smartScanService] Image type:', imageType);

    // Handle receipt
    if (imageType === 'receipt' && data.receipt_items && Array.isArray(data.receipt_items)) {
      console.log('[smartScanService] ✅ Receipt detected with', data.receipt_items.length, 'items');
      return {
        mode: 'receipt',
        imageUrl: tempImageUrl,
        imagePath: path,
        imageBucket: bucket,
        receiptItems: data.receipt_items,
        detectedCount: data.receipt_items.length,
        confidence: 1,
      };
    }

    // 3. Analyze response to determine mode
    // Multi-bottle mode always returns { bottles: [...] }
    const bottles = data.bottles && Array.isArray(data.bottles) ? data.bottles : [];
    const detectedCount = bottles.length;
    
    console.log('[smartScanService] Step 3: Analyzing response');
    console.log('[smartScanService] Response structure:', { 
      success: data.success, 
      bottlesCount: detectedCount,
      hasBottlesArray: !!data.bottles,
      bottlesIsArray: Array.isArray(data.bottles)
    });
    
    console.log('[smartScanService] Detected', detectedCount, 'bottle(s)');

    // 4. Determine mode based on detected count and confidence
    if (detectedCount === 0) {
      // No bottles detected - single mode with empty data
      console.log('[smartScanService] No bottles detected, defaulting to single mode');
      return {
        mode: 'single',
        imageUrl: tempImageUrl,
        imagePath: path,
        imageBucket: bucket,
        singleBottle: {
          extractedData: createEmptyExtractedData(path, bucket),
        },
        detectedCount: 0,
        confidence: 0,
      };
    }

    if (detectedCount === 1) {
      // Single bottle detected
      console.log('[smartScanService] ✅ Single bottle detected');
      const bottle = bottles[0];
      
      return {
        mode: 'single',
        imageUrl: tempImageUrl,
        imagePath: path,
        imageBucket: bucket,
        singleBottle: {
          extractedData: mapBottleToExtractedData(bottle, path, bucket),
        },
        detectedCount: 1,
        confidence: calculateBottleConfidence(bottle),
      };
    }

    // Multiple bottles detected
    console.log('[smartScanService] ✅ Multiple bottles detected:', detectedCount);
    
    // Map bottles to multi-bottle format
    const mappedBottles = bottles.map((b: any, index: number) => {
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
      imagePath: path,
      imageBucket: bucket,
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

    // Calculate average confidence across all bottles
    const avgConfidence = mappedBottles.length > 0
      ? mappedBottles.reduce((sum, b) => sum + b.confidence, 0) / mappedBottles.length
      : 0.5;

    return {
      mode: 'multi',
      imageUrl: tempImageUrl,
      imagePath: path,
      imageBucket: bucket,
      multipleBottles: {
        bottles: mappedBottles,
      },
      detectedCount: mappedBottles.length,
      confidence: avgConfidence,
    };

  } catch (error: any) {
    console.error('[smartScanService] ❌ Error during AI processing:', error);
    console.error('[smartScanService] Error message:', error?.message);
    console.error('[smartScanService] Error stack:', error?.stack);
    
    // Re-throw the error so the caller can handle it
    throw error;
  }
}

/**
 * Create empty extracted data for fallback
 */
function createEmptyExtractedData(_path: string, _bucket: string): ExtractedWineData {
  return {
    producer: null,
    wine_name: null,
    vintage: null,
    country: null,
    region: null,
    wine_color: null,
    grape: null,
    bottle_size_ml: 750,
    confidence: {
      producer: 'low',
      wine_name: 'low',
      vintage: 'low',
      overall: 'low',
    },
    notes: 'Please enter wine details manually',
  };
}

/**
 * Map bottle data from AI response to ExtractedWineData format
 */
function mapBottleToExtractedData(_bottle: any, _path: string, _bucket: string): ExtractedWineData {
  const bottle = _bottle;
  const getFieldValue = (field: any) => field?.value || null;
  const getFieldConfidence = (field: any) => {
    if (!field || !field.confidence) return 'low';
    return field.confidence as 'high' | 'medium' | 'low';
  };

  const producer = getFieldValue(bottle.producer);
  const wine_name = getFieldValue(bottle.name);
  const vintage = getFieldValue(bottle.vintage);
  const region = getFieldValue(bottle.region);
  const wine_color = getFieldValue(bottle.style);
  const grape = getFieldValue(bottle.grapes);

  return {
    producer,
    wine_name,
    vintage,
    country: getFieldValue(bottle.country),
    region,
    wine_color: wine_color || null,
    grape: Array.isArray(grape) ? grape.join(', ') : grape,
    bottle_size_ml: getFieldValue(bottle.bottle_size_ml) || 750,
    confidence: {
      producer: getFieldConfidence(bottle.producer),
      wine_name: getFieldConfidence(bottle.name),
      vintage: getFieldConfidence(bottle.vintage),
      overall: getFieldConfidence(bottle.overall) || calculateOverallConfidence(bottle),
    },
    notes: '',
  };
}

/**
 * Calculate overall confidence from individual fields
 */
function calculateOverallConfidence(bottle: any): 'high' | 'medium' | 'low' {
  const confidences = [
    bottle.producer?.confidence,
    bottle.name?.confidence,
    bottle.vintage?.confidence,
    bottle.region?.confidence,
  ].filter(Boolean);

  const highCount = confidences.filter(c => c === 'high').length;
  const totalCount = confidences.length;

  if (totalCount === 0) return 'low';
  if (highCount >= totalCount * 0.6) return 'high';
  if (highCount >= totalCount * 0.3) return 'medium';
  return 'low';
}

/**
 * Calculate numeric confidence for a bottle
 */
function calculateBottleConfidence(bottle: any): number {
  const getFieldConfidence = (field: any) => {
    if (!field || !field.confidence) return 0.5;
    const conf = field.confidence;
    return conf === 'high' ? 0.9 : conf === 'medium' ? 0.7 : 0.5;
  };

  const confidences = [
    getFieldConfidence(bottle.producer),
    getFieldConfidence(bottle.name),
    getFieldConfidence(bottle.vintage),
    getFieldConfidence(bottle.region),
  ];

  return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
}
