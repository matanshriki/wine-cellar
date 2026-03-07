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

import { useState, useEffect, useRef, useCallback } from 'react';
import * as storageImageService from '../services/storageImageService';
import type { BottleWithWineInfo } from '../services/bottleService';

interface WineDisplayImage {
  imageUrl: string | null;
  isGenerated: boolean;
  isPlaceholder: boolean;
  isLoading: boolean;
  /** Regenerate signed URL (e.g. after 401/403 or expired). Call once on img onError, then retry. */
  refreshImage: () => Promise<void>;
}

export function useWineDisplayImage(wine: BottleWithWineInfo['wine'] | undefined | null): WineDisplayImage {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isPlaceholder, setIsPlaceholder] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const sourceRef = useRef<{ bucket: string; path: string } | null>(null);

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

        // Priority 1: Stable storage path.
        // If image_url is also set in the DB, use it directly — it always reflects
        // the current DB state and lets admin overrides take effect immediately,
        // bypassing any stale storage cache entries.
        if ((wine as any).image_path) {
          if (wine.image_url) {
            if (!cancelled) {
              sourceRef.current = null;
              setImageUrl(wine.image_url);
              setIsGenerated(false);
              setIsPlaceholder(false);
              setIsLoading(false);
            }
            return;
          }
          // No image_url present — fall back to generating the URL from the storage path.
          const bucket = 'labels';
          const path = (wine as any).image_path;
          const url = await storageImageService.getStorageImageUrl(bucket, path);
          if (!cancelled && url) {
            sourceRef.current = { bucket, path };
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
              const url = await storageImageService.getStorageImageUrl(extracted.bucket, extracted.path);
              if (!cancelled && url) {
                sourceRef.current = { bucket: extracted.bucket, path: extracted.path };
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
            sourceRef.current = null;
            setImageUrl(wine.image_url);
            setIsGenerated(false);
            setIsPlaceholder(false);
            setIsLoading(false);
            return;
          }
        }

        // Priority 3: label_image_path — same DB-first approach.
        if ((wine as any).label_image_path) {
          const directUrl = (wine as any).label_image_url || wine.image_url;
          if (directUrl) {
            if (!cancelled) {
              sourceRef.current = null;
              setImageUrl(directUrl);
              setIsGenerated(false);
              setIsPlaceholder(false);
              setIsLoading(false);
            }
            return;
          }
          const bucket = 'labels';
          const path = (wine as any).label_image_path;
          const url = await storageImageService.getStorageImageUrl(bucket, path);
          if (!cancelled && url) {
            sourceRef.current = { bucket, path };
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
              const url = await storageImageService.getStorageImageUrl(extracted.bucket, extracted.path);
              if (!cancelled && url) {
                sourceRef.current = { bucket: extracted.bucket, path: extracted.path };
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
            sourceRef.current = null;
            setImageUrl((wine as any).label_image_url);
            setIsGenerated(false);
            setIsPlaceholder(false);
            setIsLoading(false);
            return;
          }
        }

        // Priority 5: AI-generated image
        if ((wine as any).generated_image_path) {
          const bucket = 'generated-labels';
          const path = (wine as any).generated_image_path;
          const url = await storageImageService.getStorageImageUrl(bucket, path);
          if (!cancelled && url) {
            sourceRef.current = { bucket, path };
            setImageUrl(url);
            setIsGenerated(true);
            setIsPlaceholder(false);
            setIsLoading(false);
            return;
          }
        }

        // Priority 6: Placeholder
        if (!cancelled) {
          sourceRef.current = null;
          setImageUrl(null);
          setIsGenerated(false);
          setIsPlaceholder(true);
          setIsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          sourceRef.current = null;
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

  const refreshImage = useCallback(async () => {
    const src = sourceRef.current;
    if (!src) return;
    storageImageService.clearImageCache(src.bucket, src.path);
    const url = await storageImageService.getStorageImageUrl(src.bucket, src.path, { skipCache: true });
    if (url) setImageUrl(url);
  }, []);

  return {
    imageUrl,
    isGenerated,
    isPlaceholder,
    isLoading,
    refreshImage,
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
  // Priority 1: Stable storage path.
  // We can't generate a fresh signed URL synchronously, but image_url is always
  // stored as a permanent public URL for the labels bucket and can be used directly.
  if ((wine as any).image_path) {
    if (wine.image_url) {
      return { imageUrl: wine.image_url, isGenerated: false, isPlaceholder: false };
    }
    // Path exists but no image_url yet — return placeholder; the async hook will resolve it.
    return { imageUrl: null, isGenerated: false, isPlaceholder: true };
  }

  // Priority 2: Direct image_url (external URL like Vivino, or public storage URL)
  if (wine.image_url) {
    return { imageUrl: wine.image_url, isGenerated: false, isPlaceholder: false };
  }

  // Priority 3: label_image_path — same sync fallback via any available URL
  if ((wine as any).label_image_path) {
    const fallback = (wine as any).label_image_url || wine.image_url;
    if (fallback) {
      return { imageUrl: fallback, isGenerated: false, isPlaceholder: false };
    }
    return { imageUrl: null, isGenerated: false, isPlaceholder: true };
  }

  // Priority 4: label_image_url (legacy direct URL)
  if ((wine as any).label_image_url) {
    return { imageUrl: (wine as any).label_image_url, isGenerated: false, isPlaceholder: false };
  }

  // Priority 5: AI-generated image — can't generate URL synchronously
  if ((wine as any).generated_image_path) {
    return { imageUrl: null, isGenerated: true, isPlaceholder: true };
  }

  // Priority 6: Placeholder
  return { imageUrl: null, isGenerated: false, isPlaceholder: true };
}
