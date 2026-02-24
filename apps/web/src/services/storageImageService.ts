/**
 * Storage Image Service
 * 
 * Handles image URL generation from stable storage paths.
 * Fixes issue: Storing signed URLs in DB causes images to expire.
 * Solution: Store paths, generate URLs at runtime with caching.
 */

import { supabase } from '../lib/supabase';

/**
 * In-memory cache for generated URLs
 * Key: `${bucket}:${path}`, Value: { url: string, expiresAt: number }
 */
const urlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Cache TTL: 50 minutes (signed URLs valid for 60 minutes, refresh before expiry)
 */
const CACHE_TTL_MS = 50 * 60 * 1000;

/**
 * Public bucket configuration
 * These buckets don't need signed URLs
 */
const PUBLIC_BUCKETS = ['labels', 'generated-labels'];

/**
 * Generate image URL from storage path
 * 
 * Behavior:
 * - Public buckets: return permanent public URL
 * - Private buckets: return signed URL (1 hour expiry) with caching
 * - Handles nulls/undefined gracefully
 * 
 * @param bucket - Storage bucket name (e.g., 'labels', 'generated-labels')
 * @param path - Storage object path (e.g., 'userId/uuid.jpg')
 * @returns URL string or null if path is invalid
 */
export async function getStorageImageUrl(
  bucket: string,
  path: string | null | undefined
): Promise<string | null> {
  if (!path || !bucket) {
    return null;
  }

  const cacheKey = `${bucket}:${path}`;
  const now = Date.now();

  // Check cache first
  const cached = urlCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    console.log('[storageImageService] Cache hit:', cacheKey);
    return cached.url;
  }

  // Generate new URL
  if (PUBLIC_BUCKETS.includes(bucket)) {
    // Public bucket: permanent URL
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const url = data.publicUrl;
    
    // Cache public URLs too (no harm, reduces redundant calls)
    urlCache.set(cacheKey, {
      url,
      expiresAt: now + CACHE_TTL_MS,
    });
    
    console.log('[storageImageService] Generated public URL:', cacheKey);
    return url;
  } else {
    // Private bucket: signed URL (1 hour)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour

    if (error) {
      console.error('[storageImageService] Failed to create signed URL:', error);
      return null;
    }

    // Cache signed URL
    urlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: now + CACHE_TTL_MS,
    });

    console.log('[storageImageService] Generated signed URL:', cacheKey);
    return data.signedUrl;
  }
}

/**
 * Clear URL cache (useful after user uploads new image with same path)
 */
export function clearImageCache(bucket: string, path: string) {
  const cacheKey = `${bucket}:${path}`;
  urlCache.delete(cacheKey);
  console.log('[storageImageService] Cache cleared:', cacheKey);
}

/**
 * Clear entire cache (useful for debugging)
 */
export function clearAllImageCache() {
  urlCache.clear();
  console.log('[storageImageService] All cache cleared');
}

/**
 * Extract storage path from a Supabase signed URL
 * 
 * Example input:
 * "https://xxx.supabase.co/storage/v1/object/sign/labels/userId/uuid.jpg?token=..."
 * 
 * Output: { bucket: 'labels', path: 'userId/uuid.jpg' }
 * 
 * Returns null if URL is not a Supabase Storage URL
 */
export function extractPathFromSignedUrl(url: string): {
  bucket: string;
  path: string;
} | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Match pattern: /storage/v1/object/sign/{bucket}/{path}?token=...
    const match = url.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
    
    if (!match) {
      // Also try public URL pattern: /storage/v1/object/public/{bucket}/{path}
      const publicMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)($|\?)/);
      
      if (!publicMatch) {
        console.warn('[storageImageService] URL is not a Supabase Storage URL:', url.slice(0, 100));
        return null;
      }
      
      return {
        bucket: publicMatch[1],
        path: publicMatch[2],
      };
    }

    return {
      bucket: match[1],
      path: match[2],
    };
  } catch (error) {
    console.error('[storageImageService] Error parsing URL:', error);
    return null;
  }
}

/**
 * Check if a URL is a Supabase Storage URL (signed or public)
 */
export function isStorageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return url.includes('/storage/v1/object/');
}
