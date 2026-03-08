/**
 * Supabase Edge Function: batch-enrich-images
 *
 * Processes wines that have a vivino_url but no image, in small chunks.
 * For each wine it:
 *   1. Calls fetch-vivino-data to retrieve the Vivino CDN image URL
 *   2. Downloads the image binary from that CDN URL
 *   3. Uploads it to Supabase Storage (labels/vivino/<wine_id>.jpg)
 *   4. Writes the permanent public URL + image_path back to the wines table
 *
 * Designed to be called repeatedly with an increasing offset from the
 * frontend until isComplete === true.
 *
 * Request body: { offset?: number, batchSize?: number }
 * Response:     { processed, uploaded, skipped, failed, isComplete, nextOffset }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY            = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const STORAGE_BUCKET      = "labels";
const VIVINO_IMAGE_PREFIX = "vivino";

// Delay between Vivino scrape calls to avoid rate-limiting
const SCRAPE_DELAY_MS = 2000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin
    const { data: isAdmin } = await adminClient.rpc("is_admin", { check_user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse request ─────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const offset    = Math.max(0, parseInt(body.offset    ?? "0",  10) || 0);
    const batchSize = Math.min(15, Math.max(1, parseInt(body.batchSize ?? "10", 10) || 10));

    console.log(`[BatchEnrichImages] offset=${offset} batchSize=${batchSize}`);

    // ── Fetch wines that need images ──────────────────────────────────────────
    // Only pick wines that have a vivino_url but have NO image stored at all.
    // We check image_path, label_image_path, and image_url (to avoid overwriting
    // user-uploaded photos or images already fetched from Vivino).
    const { data: wines, error: fetchError } = await adminClient
      .from("wines")
      .select("id, wine_name, vivino_url, image_path, label_image_path, image_url")
      .not("vivino_url", "is", null)
      .is("image_path", null)
      .is("label_image_path", null)
      .is("image_url", null)
      .order("id")
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      throw new Error(`DB fetch error: ${fetchError.message}`);
    }

    const stats = { processed: 0, uploaded: 0, skipped: 0, failed: 0 };
    const errors: Array<{ wine_id: string; error: string }> = [];

    for (const wine of (wines ?? [])) {
      stats.processed++;
      const label = `[${stats.processed}/${wines!.length}] ${wine.wine_name} (${wine.id})`;

      try {
        // ── Step 1: Extract Vivino ID from URL ────────────────────────────────
        const idMatch = wine.vivino_url?.match(/\/w\/(\d+)/);
        if (!idMatch) {
          console.log(`${label} — skip: invalid vivino_url`);
          stats.skipped++;
          continue;
        }
        const vivinoId = idMatch[1];

        // ── Step 2: Scrape Vivino page to get CDN image URL ───────────────────
        const scrapeRes = await fetch(
          `${SUPABASE_URL}/functions/v1/fetch-vivino-data`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${ANON_KEY}`,
            },
            body: JSON.stringify({ wine_id: vivinoId }),
          }
        );

        // Respect Vivino rate limits
        await new Promise((r) => setTimeout(r, SCRAPE_DELAY_MS));

        if (!scrapeRes.ok) {
          throw new Error(`fetch-vivino-data returned ${scrapeRes.status}`);
        }

        const scrapeData = await scrapeRes.json();
        const vivinoCdnUrl: string | null = scrapeData?.data?.image_url ?? null;

        if (!vivinoCdnUrl) {
          console.log(`${label} — skip: no image_url from Vivino`);
          stats.skipped++;
          continue;
        }

        console.log(`${label} — CDN URL: ${vivinoCdnUrl}`);

        // ── Step 3: Download image binary from Vivino CDN ─────────────────────
        const imgRes = await fetch(vivinoCdnUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Referer": "https://www.vivino.com/",
          },
        });

        if (!imgRes.ok) {
          throw new Error(`Image download failed: HTTP ${imgRes.status}`);
        }

        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        const ext = contentType.includes("png") ? "png" : "jpg";
        const imageBytes = await imgRes.arrayBuffer();

        if (imageBytes.byteLength < 1000) {
          throw new Error(`Downloaded image too small (${imageBytes.byteLength} bytes) — likely a placeholder`);
        }

        // ── Step 4: Upload to Supabase Storage ────────────────────────────────
        const storagePath = `${VIVINO_IMAGE_PREFIX}/${wine.id}.${ext}`;

        const { error: uploadError } = await adminClient.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, imageBytes, {
            contentType,
            upsert: true,   // overwrite if a previous attempt left a partial file
          });

        if (uploadError) {
          throw new Error(`Storage upload error: ${uploadError.message}`);
        }

        // ── Step 5: Get permanent public URL ──────────────────────────────────
        const { data: { publicUrl } } = adminClient.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(storagePath);

        // ── Step 6: Update wines table ────────────────────────────────────────
        const { error: updateError } = await adminClient
          .from("wines")
          .update({
            image_path: storagePath,
            image_url:  publicUrl,
          })
          .eq("id", wine.id);

        if (updateError) {
          throw new Error(`DB update error: ${updateError.message}`);
        }

        console.log(`${label} — ✅ uploaded to ${storagePath}`);
        stats.uploaded++;
      } catch (err: any) {
        console.error(`${label} — ❌ ${err.message}`);
        stats.failed++;
        errors.push({ wine_id: wine.id, error: err.message });
      }
    }

    // isComplete when we got fewer wines than requested (end of the list)
    const isComplete = (wines?.length ?? 0) < batchSize;
    const nextOffset = offset + (wines?.length ?? 0);

    console.log(`[BatchEnrichImages] done — uploaded=${stats.uploaded} skipped=${stats.skipped} failed=${stats.failed} isComplete=${isComplete}`);

    return new Response(
      JSON.stringify({ ...stats, isComplete, nextOffset, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[BatchEnrichImages] fatal error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
