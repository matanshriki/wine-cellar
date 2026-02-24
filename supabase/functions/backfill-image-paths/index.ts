/**
 * Backfill Image Paths Edge Function
 * 
 * Converts stored signed URLs to stable storage paths.
 * Fixes issue: Images break when signed URLs expire.
 * 
 * Admin-only operation with batching and resumability.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract storage path from a Supabase signed or public URL
 */
function extractPathFromUrl(url: string): { bucket: string; path: string } | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Match pattern: /storage/v1/object/sign/{bucket}/{path}?token=...
    const signedMatch = url.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
    
    if (signedMatch) {
      return {
        bucket: signedMatch[1],
        path: signedMatch[2],
      };
    }

    // Also try public URL pattern: /storage/v1/object/public/{bucket}/{path}
    const publicMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)($|\?)/);
    
    if (publicMatch) {
      return {
        bucket: publicMatch[1],
        path: publicMatch[2],
      };
    }

    return null;
  } catch (error) {
    console.error('[extractPathFromUrl] Error parsing URL:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated and is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[backfill-image-paths] ✅ Admin verified:', user.email);

    // Parse request body
    const { action, batchSize = 100 } = await req.json();

    // ACTION: Get counts for reporting
    if (action === 'get-counts') {
      // Count bottles needing backfill
      const { count: bottlesNeedingBackfill } = await supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .is('image_path', null)
        .like('image_url', '%/storage/v1/object/%');

      const { count: bottlesWithLabelNeedingBackfill } = await supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .is('label_image_path', null)
        .like('label_image_url', '%/storage/v1/object/%');

      // Count wines needing backfill
      const { count: winesNeedingBackfill } = await supabase
        .from('wines')
        .select('*', { count: 'exact', head: true })
        .is('image_path', null)
        .like('image_url', '%/storage/v1/object/%');

      const { count: winesWithLabelNeedingBackfill } = await supabase
        .from('wines')
        .select('*', { count: 'exact', head: true })
        .is('label_image_path', null)
        .like('label_image_url', '%/storage/v1/object/%');

      return new Response(
        JSON.stringify({
          success: true,
          counts: {
            bottles: {
              image: bottlesNeedingBackfill || 0,
              label: bottlesWithLabelNeedingBackfill || 0,
            },
            wines: {
              image: winesNeedingBackfill || 0,
              label: winesWithLabelNeedingBackfill || 0,
            },
            total: (bottlesNeedingBackfill || 0) + (bottlesWithLabelNeedingBackfill || 0) + 
                   (winesNeedingBackfill || 0) + (winesWithLabelNeedingBackfill || 0),
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ACTION: Process batch
    if (action === 'process-batch') {
      let processedCount = 0;
      let errorCount = 0;

      // Process bottles.image_url
      const { data: bottlesWithImageUrl } = await supabase
        .from('bottles')
        .select('id, image_url')
        .is('image_path', null)
        .like('image_url', '%/storage/v1/object/%')
        .limit(batchSize);

      if (bottlesWithImageUrl) {
        for (const bottle of bottlesWithImageUrl) {
          const extracted = extractPathFromUrl(bottle.image_url);
          if (extracted) {
            const { error } = await supabase
              .from('bottles')
              .update({ image_path: extracted.path })
              .eq('id', bottle.id);

            if (error) {
              console.error('[backfill] Error updating bottle image_path:', error);
              errorCount++;
            } else {
              processedCount++;
            }
          } else {
            errorCount++;
          }
        }
      }

      // Process bottles.label_image_url
      const { data: bottlesWithLabelUrl } = await supabase
        .from('bottles')
        .select('id, label_image_url')
        .is('label_image_path', null)
        .like('label_image_url', '%/storage/v1/object/%')
        .limit(batchSize);

      if (bottlesWithLabelUrl) {
        for (const bottle of bottlesWithLabelUrl) {
          const extracted = extractPathFromUrl(bottle.label_image_url);
          if (extracted) {
            const { error } = await supabase
              .from('bottles')
              .update({ label_image_path: extracted.path })
              .eq('id', bottle.id);

            if (error) {
              console.error('[backfill] Error updating bottle label_image_path:', error);
              errorCount++;
            } else {
              processedCount++;
            }
          } else {
            errorCount++;
          }
        }
      }

      // Process wines.image_url
      const { data: winesWithImageUrl } = await supabase
        .from('wines')
        .select('id, image_url')
        .is('image_path', null)
        .like('image_url', '%/storage/v1/object/%')
        .limit(batchSize);

      if (winesWithImageUrl) {
        for (const wine of winesWithImageUrl) {
          const extracted = extractPathFromUrl(wine.image_url);
          if (extracted) {
            const { error } = await supabase
              .from('wines')
              .update({ image_path: extracted.path })
              .eq('id', wine.id);

            if (error) {
              console.error('[backfill] Error updating wine image_path:', error);
              errorCount++;
            } else {
              processedCount++;
            }
          } else {
            errorCount++;
          }
        }
      }

      // Process wines.label_image_url
      const { data: winesWithLabelUrl } = await supabase
        .from('wines')
        .select('id, label_image_url')
        .is('label_image_path', null)
        .like('label_image_url', '%/storage/v1/object/%')
        .limit(batchSize);

      if (winesWithLabelUrl) {
        for (const wine of winesWithLabelUrl) {
          const extracted = extractPathFromUrl(wine.label_image_url);
          if (extracted) {
            const { error } = await supabase
              .from('wines')
              .update({ label_image_path: extracted.path })
              .eq('id', wine.id);

            if (error) {
              console.error('[backfill] Error updating wine label_image_path:', error);
              errorCount++;
            } else {
              processedCount++;
            }
          } else {
            errorCount++;
          }
        }
      }

      // Get remaining count
      const { count: remainingBottlesImage } = await supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .is('image_path', null)
        .like('image_url', '%/storage/v1/object/%');

      const { count: remainingBottlesLabel } = await supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .is('label_image_path', null)
        .like('label_image_url', '%/storage/v1/object/%');

      const { count: remainingWinesImage } = await supabase
        .from('wines')
        .select('*', { count: 'exact', head: true })
        .is('image_path', null)
        .like('image_url', '%/storage/v1/object/%');

      const { count: remainingWinesLabel } = await supabase
        .from('wines')
        .select('*', { count: 'exact', head: true })
        .is('label_image_path', null)
        .like('label_image_url', '%/storage/v1/object/%');

      const totalRemaining = (remainingBottlesImage || 0) + (remainingBottlesLabel || 0) +
                             (remainingWinesImage || 0) + (remainingWinesLabel || 0);

      return new Response(
        JSON.stringify({
          success: true,
          processed: processedCount,
          errors: errorCount,
          remaining: totalRemaining,
          complete: totalRemaining === 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Invalid action
    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "get-counts" or "process-batch"' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[backfill-image-paths] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
