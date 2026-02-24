/**
 * React Hook: Wine Display Image
 * 
 * Generates display URLs from storage paths at runtime.
 * Handles loading states and caching automatically.
 * 
 * Usage:
 * ```tsx
 * const { imageUrl, isGenerated, isLoading } = useWineDisplayImage(wine);
 * ```
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import * as storageImageService from '../services/storageImageService';
import type { BottleWithWineInfo } from '../services/bottleService';

interface WineDisplayImage {
  imageUrl: string | null;
  isGenerated: boolean;
  isPlaceholder: boolean;
  isLoading: boolean;
}

export function useWineDisplayImage(wine: BottleWithWineInfo['wine'] | undefined | null): WineDisplayImage {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isPlaceholder, setIsPlaceholder] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!wine) {
      setImageUrl(null);
      setIsGenerated(false);
      setIsPlaceholder(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadImage() {
      try {
        setIsLoading(true);

        // Priority 1: User-provided image via stable path
        if ((wine as any).image_path) {
          const url = await storageImageService.getStorageImageUrl('labels', (wine as any).image_path);
          if (!cancelled && url) {
            setImageUrl(url);
            setIsGenerated(false);
            setIsPlaceholder(false);
            setIsLoading(false);
            return;
          }
        }

        // Priority 2: Legacy fallback - user-provided image_url
        if (wine.image_url) {
          // If it's a Supabase Storage URL, extract path and generate fresh URL
          if (storageImageService.isStorageUrl(wine.image_url)) {
            const extracted = storageImageService.extractPathFromSignedUrl(wine.image_url);
            if (extracted) {
              console.log('[useWineDisplayImage] Extracted path from legacy URL:', extracted);
              const url = await storageImageService.getStorageImageUrl(extracted.bucket, extracted.path);
              if (!cancelled && url) {
                setImageUrl(url);
                setIsGenerated(false);
                setIsPlaceholder(false);
                setIsLoading(false);
                return;
              }
            }
          }
          
          // Not a storage URL (external URL like Vivino) or extraction failed - use as-is
          if (!cancelled) {
            setImageUrl(wine.image_url);
            setIsGenerated(false);
            setIsPlaceholder(false);
            setIsLoading(false);
            return;
          }
        }

        // Priority 3: label_image_path
        if ((wine as any).label_image_path) {
          const url = await storageImageService.getStorageImageUrl('labels', (wine as any).label_image_path);
          if (!cancelled && url) {
            setImageUrl(url);
            setIsGenerated(false);
            setIsPlaceholder(false);
            setIsLoading(false);
            return;
          }
        }

        // Priority 4: Legacy fallback - label_image_url
        if ((wine as any).label_image_url) {
          // If it's a Supabase Storage URL, extract path and generate fresh URL
          if (storageImageService.isStorageUrl((wine as any).label_image_url)) {
            const extracted = storageImageService.extractPathFromSignedUrl((wine as any).label_image_url);
            if (extracted) {
              console.log('[useWineDisplayImage] Extracted path from legacy label URL:', extracted);
              const url = await storageImageService.getStorageImageUrl(extracted.bucket, extracted.path);
              if (!cancelled && url) {
                setImageUrl(url);
                setIsGenerated(false);
                setIsPlaceholder(false);
                setIsLoading(false);
                return;
              }
            }
          }
          
          // Not a storage URL or extraction failed - use as-is
          if (!cancelled) {
            setImageUrl((wine as any).label_image_url);
            setIsGenerated(false);
            setIsPlaceholder(false);
            setIsLoading(false);
            return;
          }
        }

        // Priority 5: AI-generated image
        if ((wine as any).generated_image_path) {
          const url = await storageImageService.getStorageImageUrl('generated-labels', (wine as any).generated_image_path);
          if (!cancelled && url) {
            setImageUrl(url);
            setIsGenerated(true);
            setIsPlaceholder(false);
            setIsLoading(false);
            return;
          }
        }

        // Priority 6: Placeholder
        if (!cancelled) {
          setImageUrl(null);
          setIsGenerated(false);
          setIsPlaceholder(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[useWineDisplayImage] Error loading image:', error);
        if (!cancelled) {
          setImageUrl(null);
          setIsGenerated(false);
          setIsPlaceholder(true);
          setIsLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [wine?.id, (wine as any)?.image_path, wine?.image_url, (wine as any)?.label_image_path, (wine as any)?.label_image_url, (wine as any)?.generated_image_path]);

  return {
    imageUrl,
    isGenerated,
    isPlaceholder,
    isLoading,
  };
}

/**
 * Synchronous version for backward compatibility
 * Use useWineDisplayImage hook for new components
 * 
 * NOTE: This function now handles legacy signed URLs by extracting paths
 * but returns the URL immediately (doesn't wait for async operations).
 * For best results, use the hook version above.
 */
export function getWineDisplayImageSync(wine: BottleWithWineInfo['wine']): {
  imageUrl: string | null;
  isGenerated: boolean;
  isPlaceholder: boolean;
} {
  // Priority 1: User-provided path - can't generate URL synchronously
  // Return null and let caller use the hook version
  if ((wine as any).image_path) {
    return {
      imageUrl: null, // Hook version will handle this
      isGenerated: false,
      isPlaceholder: true, // Temporarily show placeholder
    };
  }

  // Priority 2: User-provided image_url (might be external or legacy storage URL)
  if (wine.image_url) {
    return {
      imageUrl: wine.image_url, // Use as-is, might be external URL
      isGenerated: false,
      isPlaceholder: false,
    };
  }

  // Priority 3: label_image_path - can't generate URL synchronously
  if ((wine as any).label_image_path) {
    return {
      imageUrl: null,
      isGenerated: false,
      isPlaceholder: true,
    };
  }

  // Priority 4: label_image_url (legacy)
  if ((wine as any).label_image_url) {
    return {
      imageUrl: (wine as any).label_image_url,
      isGenerated: false,
      isPlaceholder: false,
    };
  }

  // Priority 5: AI-generated image - can't generate URL synchronously
  if ((wine as any).generated_image_path) {
    return {
      imageUrl: null,
      isGenerated: true,
      isPlaceholder: true,
    };
  }

  // Priority 6: Placeholder
  return {
    imageUrl: null,
    isGenerated: false,
    isPlaceholder: true,
  };
}
