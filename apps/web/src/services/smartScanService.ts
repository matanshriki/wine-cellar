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
  imagePath?: string;  // Stable storage path
  imageBucket?: string;  // Storage bucket name
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
 */
export async function performSmartScan(file: File): Promise<SmartScanResult> {
  try {
    // 1. Upload image (returns stable path)
    const { path, bucket } = await uploadLabelImage(file);

    // 2. Generate temporary signed URL for Edge Function
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 600); // 10 minutes

    if (signedError) {
      throw new Error('Failed to generate image URL for processing');
    }

    const tempImageUrl = signedUrlData.signedUrl;

    // 3. Call AI with multi-bottle mode (always returns array, which we then analyze)
    const { data, error } = await supabase.functions.invoke('parse-label-image', {
      body: {
        imageUrl: tempImageUrl,
        mode: 'multi-bottle',
      },
    });

    if (error) throw new Error(`AI extraction failed: ${error.message}`);

    if (!data) {
      return {
        mode: 'single',
        imageUrl: tempImageUrl,
        imagePath: path,
        imageBucket: bucket,
        singleBottle: { extractedData: createEmptyExtractedData(path, bucket) },
        detectedCount: 0,
        confidence: 0,
      };
    }

    const imageType = data.image_type || 'label';

    // Handle receipt
    if (imageType === 'receipt' && data.receipt_items && Array.isArray(data.receipt_items)) {
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

    // 4. Analyze response to determine mode
    const bottles = data.bottles && Array.isArray(data.bottles) ? data.bottles : [];
    const detectedCount = bottles.length;

    if (detectedCount === 0) {
      return {
        mode: 'single',
        imageUrl: tempImageUrl,
        imagePath: path,
        imageBucket: bucket,
        singleBottle: { extractedData: createEmptyExtractedData(path, bucket) },
        detectedCount: 0,
        confidence: 0,
      };
    }

    if (detectedCount === 1) {
      return {
        mode: 'single',
        imageUrl: tempImageUrl,
        imagePath: path,
        imageBucket: bucket,
        singleBottle: {
          extractedData: mapBottleToExtractedData(bottles[0], path, bucket),
        },
        detectedCount: 1,
        confidence: calculateBottleConfidence(bottles[0]),
      };
    }

    // Multiple bottles detected
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

    const avgConfidence = mappedBottles.length > 0
      ? mappedBottles.reduce((sum: number, b: any) => sum + b.confidence, 0) / mappedBottles.length
      : 0.5;

    return {
      mode: 'multi',
      imageUrl: tempImageUrl,
      imagePath: path,
      imageBucket: bucket,
      multipleBottles: { bottles: mappedBottles },
      detectedCount: mappedBottles.length,
      confidence: avgConfidence,
    };

  } catch (error: any) {
    console.error('[SmartScan] Error:', error?.message);
    throw error;
  }
}

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
    confidence: { producer: 'low', wine_name: 'low', vintage: 'low', overall: 'low' },
    notes: 'Please enter wine details manually',
  };
}

function mapBottleToExtractedData(_bottle: any, _path: string, _bucket: string): ExtractedWineData {
  const bottle = _bottle;
  const getFieldValue = (field: any) => field?.value || null;
  const getFieldConfidence = (field: any) => {
    if (!field || !field.confidence) return 'low';
    return field.confidence as 'high' | 'medium' | 'low';
  };

  const grape = getFieldValue(bottle.grapes);

  return {
    producer: getFieldValue(bottle.producer),
    wine_name: getFieldValue(bottle.name),
    vintage: getFieldValue(bottle.vintage),
    country: getFieldValue(bottle.country),
    region: getFieldValue(bottle.region),
    wine_color: getFieldValue(bottle.style) || null,
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
