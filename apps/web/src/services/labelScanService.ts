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
 */
export async function compressImage(file: File, maxWidth = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob (JPEG, 85% quality)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/jpeg',
          0.85
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
    throw new Error('Not authenticated');
  }

  // Compress image before upload
  const compressedBlob = await compressImage(file);
  
  // Generate unique filename
  const fileExt = 'jpg'; // Always JPEG after compression
  const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
  const filePath = `labels/${fileName}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('labels')
    .upload(fileName, compressedBlob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload image');
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('labels')
    .getPublicUrl(fileName);

  return publicUrl;
}

/**
 * Extract wine data from label image using AI
 */
export async function extractWineFromLabel(imageUrl: string): Promise<ExtractedWineData> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

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

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to extract wine data');
    }

    return data.data as ExtractedWineData;
  } catch (error) {
    console.error('Label extraction error:', error);
    throw error;
  }
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

