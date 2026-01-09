/**
 * Label Scan Service
 * 
 * Handles wine label photo capture, upload, and AI extraction
 */

import { supabase } from '../lib/supabase';

export interface ExtractedWineData {
  producer: string | null;
  wine_name: string | null;
  vintage: number | null;
  country: string | null;
  region: string | null;
  wine_color: 'red' | 'white' | 'rose' | 'sparkling' | null;
  grape: string | null;
  bottle_size_ml: number | null;
  vivino_url?: string; // Wishlist feature - auto-generated Vivino search URL
  confidence: {
    producer: 'high' | 'medium' | 'low';
    wine_name: 'high' | 'medium' | 'low';
    vintage: 'high' | 'medium' | 'low';
    overall: 'high' | 'medium' | 'low';
  };
  notes: string;
}

/**
 * Compress and resize image before upload (client-side)
 * Reduces upload time and storage costs
 * 
 * Target: Reduce file size by 70-90% while maintaining readability
 * Strategy: Resize to reasonable dimensions + JPEG compression
 */
export async function compressImage(file: File, maxWidth = 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const originalWidth = img.width;
        const originalHeight = img.height;
        
        // Calculate new dimensions (max 1024px for labels, good balance of quality vs size)
        let width = originalWidth;
        let height = originalHeight;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        // Also cap height to prevent extremely tall images
        const maxHeight = 1400;
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        console.log('[compressImage] Resizing:', {
          original: `${originalWidth}x${originalHeight}`,
          new: `${Math.round(width)}x${Math.round(height)}`,
          reduction: `${Math.round((1 - (width * height) / (originalWidth * originalHeight)) * 100)}%`,
        });
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob (JPEG, 80% quality - good balance)
        // 80% is sweet spot: much smaller files, imperceptible quality loss
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('[compressImage] Compression complete:', {
                originalSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
                compressedSize: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
                reduction: `${Math.round((1 - blob.size / file.size) * 100)}%`,
              });
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/jpeg',
          0.80  // Reduced from 0.85 to 0.80 for smaller files
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload label image to Supabase Storage
 */
export async function uploadLabelImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated. Please log in and try again.');
  }

  console.log('[uploadLabelImage] Starting upload for user:', user.id);

  // Compress image before upload
  const compressedBlob = await compressImage(file);
  console.log('[uploadLabelImage] Image compressed:', {
    original: file.size,
    compressed: compressedBlob.size,
  });
  
  // Generate unique filename
  const fileExt = 'jpg'; // Always JPEG after compression
  const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

  console.log('[uploadLabelImage] Uploading to bucket: labels, path:', fileName);

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('labels')
    .upload(fileName, compressedBlob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    console.error('[uploadLabelImage] Upload error:', error);
    
    // Provide user-friendly error messages
    if (error.message?.includes('row-level security')) {
      throw new Error(
        'Upload permissions not configured. Please contact support or check Storage policies in Supabase Dashboard.'
      );
    }
    
    if (error.message?.includes('Bucket not found')) {
      throw new Error(
        'Storage bucket not found. Please ensure the "labels" bucket exists in Supabase Storage.'
      );
    }
    
    throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
  }

  console.log('[uploadLabelImage] Upload successful:', data);

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('labels')
    .getPublicUrl(fileName);

  console.log('[uploadLabelImage] Public URL:', publicUrl);

  return publicUrl;
}

/**
 * Extract wine data from label image using AI
 * TEMPORARY: Returns placeholder data until Edge Function is deployed
 */
export async function extractWineFromLabel(imageUrl: string): Promise<ExtractedWineData> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  console.log('[extractWineFromLabel] AI extraction temporarily disabled, returning placeholder');
  console.log('[extractWineFromLabel] To enable AI: Deploy Edge Function (see DEPLOY_EDGE_FUNCTION_FIX.md)');

  // TEMPORARY: Return placeholder data until Edge Function is deployed
  // User can manually fill in the details
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
    notes: 'AI extraction is not configured. Please enter details manually.',
  };

  /* ORIGINAL CODE - Uncomment when Edge Function is deployed
  try {
    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('extract-wine-label', {
      body: {
        image_url: imageUrl,
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error('Failed to extract wine data from label');
    }

    if (data.success || !data.data) {
      throw new Error(data.error || 'Failed to extract wine data');
    }

    return data.data as ExtractedWineData;
  } catch (error) {
    console.error('Label extraction error:', error);
    throw error;
  }
  */
}

/**
 * Full flow: Upload image and extract wine data
 */
export async function scanLabelImage(file: File): Promise<{
  imageUrl: string;
  extractedData: ExtractedWineData;
}> {
  // 1. Upload image
  const imageUrl = await uploadLabelImage(file);
  
  // 2. Extract wine data
  const extractedData = await extractWineFromLabel(imageUrl);
  
  return {
    imageUrl,
    extractedData,
  };
}

