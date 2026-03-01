/**
 * Receipt Scan Service
 * 
 * Handles scanning and parsing wine receipts/invoices.
 * Extracts line items from receipt images using AI.
 */

import { supabase } from '../lib/supabase';
import { uploadLabelImage } from './labelScanService';

export interface ReceiptItem {
  producer?: string | null;
  name?: string | null;
  vintage?: number | null;
  quantity?: number | null;
  price?: number | null;
  color?: 'red' | 'white' | 'rose' | 'sparkling' | null;
  confidence: 'low' | 'medium' | 'high';
}

export interface ReceiptScanResult {
  imageUrl: string;
  items: ReceiptItem[];
  confidence: string;
  detectedCount: number;
}

/**
 * Scan a receipt/invoice image and extract wine line items
 * 
 * @param file - Receipt image file
 * @returns Parsed receipt with line items
 */
export async function scanReceipt(file: File): Promise<ReceiptScanResult> {
  console.log('[receiptScan] ========== RECEIPT SCAN START ==========');
  console.log('[receiptScan] File:', file.name, file.size, 'bytes', file.type);

  try {
    // 1. Upload image (returns stable path)
    console.log('[receiptScan] Step 1: Uploading receipt image...');
    const { path, bucket } = await uploadLabelImage(file);
    console.log('[receiptScan] ✅ Image uploaded, path:', path);

    // 2. Generate temporary signed URL for Edge Function
    // (Edge Function needs URL to fetch image, but we don't store this URL)
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 600); // 10 minutes

    if (signedError) {
      console.error('[receiptScan] Failed to create signed URL:', signedError);
      throw new Error('Failed to generate image URL for processing');
    }

    const tempImageUrl = signedUrlData.signedUrl;
    console.log('[receiptScan] Created temporary URL for AI processing');

    // 3. Call AI edge function with multi-bottle mode
    // The edge function will auto-detect if it's a receipt and return appropriate data
    console.log('[receiptScan] Step 2: Calling edge function...');
    
    const { data, error } = await supabase.functions.invoke('parse-label-image', {
      body: {
        imageUrl: tempImageUrl,
        mode: 'multi-bottle', // Will auto-detect receipt vs labels
      },
    });

    if (error) {
      console.error('[receiptScan] ❌ Edge function error:', error);
      throw new Error(`Receipt parsing failed: ${error.message}`);
    }

    console.log('[receiptScan] Edge function response:', data);

    // Check if receipt was detected
    if (data.image_type === 'receipt' && data.receipt_items) {
      console.log('[receiptScan] ✅ Receipt detected with', data.receipt_items.length, 'items');
      
      // Note: We don't return imageUrl anymore since it's not needed
      // (receipt images aren't saved to DB, only the parsed items)
      return {
        imageUrl: tempImageUrl, // Temporary URL for immediate display if needed
        items: data.receipt_items,
        confidence: data.confidence || 'medium',
        detectedCount: data.receipt_items.length,
      };
    }

    // Not a receipt - might be labels
    if (data.bottles || data.image_type === 'label') {
      console.warn('[receiptScan] Image appears to be labels, not a receipt');
      throw new Error('This appears to be a wine label, not a receipt');
    }

    // Unknown or empty
    console.warn('[receiptScan] No receipt items detected');
    throw new Error('No items found on receipt. Please try a clearer image.');
    
  } catch (error: any) {
    console.error('[receiptScan] ❌ Error:', error);
    throw error;
  }
}

/**
 * Add receipt items to cellar
 * Handles duplicate detection for each item
 * 
 * @param items - Receipt items to add
 * @returns Results with created/updated bottle IDs
 */
export async function addReceiptItems(
  items: ReceiptItem[]
): Promise<{ created: string[]; updated: string[] }> {
  console.log('[receiptScan] Adding', items.length, 'receipt items to cellar');
  
  const created: string[] = [];
  const updated: string[] = [];
  
  // This will be implemented when integrating with bottleService
  // For now, return empty results
  
  return { created, updated };
}
