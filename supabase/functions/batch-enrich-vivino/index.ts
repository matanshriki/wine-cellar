import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

interface Wine {
  id: string;
  wine_name: string;
  producer: string;
  vintage?: number;
  vivino_url?: string;
  rating?: number;
  region?: string;
  country?: string;
  grapes?: string[];
  regional_wine_style?: string;
  user_id: string;
}

interface WineDetail {
  wine_id: string;
  wine_name: string;
  producer: string;
  vintage: number | null;
  vivino_url: string | null;
  status: 'enriched' | 'skipped' | 'failed';
  skip_reason: string | null;
  fields_updated: string[] | null;
  error: string | null;
}

interface BatchProgress {
  total: number;
  processed: number;
  enriched: number;
  failed: number;
  skipped: number;
  errors: Array<{ wine_id: string; error: string }>;
  details: WineDetail[];
}

// Rate limiting: 1 request per 2 seconds (30 per minute to be safe)
const DELAY_BETWEEN_REQUESTS = 2000;
const BATCH_SIZE = 50; // Process 50 wines at a time

Deno.serve(async (req) => {
  console.log("[Batch Enrich] ========== NEW REQUEST ==========");
  console.log("[Batch Enrich] Method:", req.method);
  console.log("[Batch Enrich] URL:", req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[Batch Enrich] CORS preflight request");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // TEMPORARILY SKIP ALL AUTH FOR DEBUGGING
    console.log("[Batch Enrich] ⚠️⚠️⚠️ ALL AUTH TEMPORARILY DISABLED FOR DEBUGGING ⚠️⚠️⚠️");
    
    const authHeader = req.headers.get("Authorization");
    console.log("[Batch Enrich] Authorization header present:", !!authHeader);
    console.log("[Batch Enrich] Auth header:", authHeader?.substring(0, 50));
    
    // Create service role client for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    console.log("[Batch Enrich] Supabase URL:", supabaseUrl);
    console.log("[Batch Enrich] Service Role Key present:", !!serviceRoleKey);
    console.log("[Batch Enrich] Anon Key present:", !!anonKey);
    
    const supabaseClient = createClient(
      supabaseUrl ?? "",
      serviceRoleKey ?? ""
    );

    // Hardcode user for testing
    const testUserId = "5782c9f4-b52d-486b-adaf-80263b39012f";
    console.log(`[Batch Enrich] ⚠️ Using hardcoded test user: ${testUserId}`);

    // Parse request options
    const { dryRun = false, limit = 1000 } = await req.json().catch(() => ({}));

    // Fetch all wines that need enrichment
    // Criteria: Have vivino_url but missing other data (rating, region, grapes, or regional_wine_style)
    const { data: wines, error: fetchError } = await supabaseClient
      .from("wines")
      .select("id, wine_name, producer, vintage, vivino_url, rating, region, country, grapes, regional_wine_style, user_id")
      .not("vivino_url", "is", null)
      .or("rating.is.null,region.is.null,country.is.null,grapes.is.null,regional_wine_style.is.null")
      .limit(limit);

    if (fetchError) {
      console.error("[Batch Enrich] Error fetching wines:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch wines", details: fetchError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const progress: BatchProgress = {
      total: wines?.length || 0,
      processed: 0,
      enriched: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      details: [],
    };

    console.log(`[Batch Enrich] Found ${progress.total} wines to process`);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          message: "Dry run completed",
          progress,
          winesToProcess: wines?.slice(0, 10),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helper to push a detail record
    const addDetail = (
      wine: Wine,
      status: WineDetail['status'],
      opts: { skip_reason?: string; fields_updated?: string[]; error?: string } = {}
    ) => {
      progress.details.push({
        wine_id: wine.id,
        wine_name: wine.wine_name,
        producer: wine.producer,
        vintage: wine.vintage ?? null,
        vivino_url: wine.vivino_url ?? null,
        status,
        skip_reason: opts.skip_reason ?? null,
        fields_updated: opts.fields_updated ?? null,
        error: opts.error ?? null,
      });
    };

    // Process wines in batches
    for (let i = 0; i < (wines?.length || 0); i += BATCH_SIZE) {
      const batch = wines!.slice(i, i + BATCH_SIZE);
      console.log(`[Batch Enrich] Processing batch ${i / BATCH_SIZE + 1} (${batch.length} wines)`);

      for (const wine of batch) {
        try {
          progress.processed++;

          console.log(`[Batch Enrich] [${progress.processed}/${progress.total}] Processing: ${wine.wine_name} (ID: ${wine.id})`);
          console.log(`[Batch Enrich] Current data - Rating: ${wine.rating}, Region: ${wine.region}, Grapes: ${JSON.stringify(wine.grapes)}, Style: ${wine.regional_wine_style}`);
          console.log(`[Batch Enrich] Vivino URL: ${wine.vivino_url}`);

          // Extract wine_id from vivino_url
          const vivinoIdMatch = wine.vivino_url?.match(/\/w\/(\d+)/);
          if (!vivinoIdMatch) {
            const reason = `Invalid Vivino URL format: "${wine.vivino_url}"`;
            console.log(`[Batch Enrich] ⏭️ SKIP REASON: ${reason}`);
            progress.skipped++;
            addDetail(wine, 'skipped', { skip_reason: reason });
            continue;
          }

          const vivinoWineId = vivinoIdMatch[1];
          console.log(`[Batch Enrich] Extracted Vivino ID: ${vivinoWineId}`);

          // Fetch Vivino data using the wine ID
          const vivinoResponse = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/fetch-vivino-data`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({ wine_id: vivinoWineId }),
            }
          );

          // Rate limiting delay
          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));

          console.log(`[Batch Enrich] Vivino API response status: ${vivinoResponse.status}`);

          if (!vivinoResponse.ok) {
            const errorText = await vivinoResponse.text();
            const reason = `Vivino HTTP error ${vivinoResponse.status}: ${errorText.slice(0, 200)}`;
            console.log(`[Batch Enrich] ⏭️ SKIP REASON: ${reason}`);
            progress.skipped++;
            addDetail(wine, 'skipped', { skip_reason: reason });
            continue;
          }

          const vivinoData = await vivinoResponse.json();
          console.log(`[Batch Enrich] Vivino data received:`, JSON.stringify(vivinoData, null, 2));

          // Extract wine data from response (handle both formats)
          const wineData = vivinoData.data || vivinoData;
          console.log(`[Batch Enrich] Wine data extracted:`, JSON.stringify(wineData, null, 2));

          // Check if we got valid data (country is now included in the check)
          if (!wineData.rating && !wineData.region && !wineData.country && !wineData.grapes && !wineData.wine_style) {
            const reason = "Vivino returned no enrichable data (no rating, region, country, grapes, or style)";
            console.log(`[Batch Enrich] ⏭️ SKIP REASON: ${reason}`);
            progress.skipped++;
            addDetail(wine, 'skipped', { skip_reason: reason });
            continue;
          }

          // Update wine with Vivino data (only update missing fields)
          const updateData: any = {};
          if (wineData.rating && !wine.rating) updateData.rating = wineData.rating;
          if (wineData.region && !wine.region) updateData.region = wineData.region;
          if (wineData.country && !wine.country) updateData.country = wineData.country;
          if (wineData.grapes && (!wine.grapes || wine.grapes.length === 0)) {
            updateData.grapes = wineData.grapes;
          }
          // Map wine_style → regional_wine_style (both field names tried for safety)
          const vivinoStyle = wineData.wine_style || wineData.regional_wine_style;
          if (vivinoStyle && !wine.regional_wine_style) {
            updateData.regional_wine_style = vivinoStyle;
          }

          console.log(`[Batch Enrich] Fields to update:`, Object.keys(updateData));

          // Only update if we have new data
          if (Object.keys(updateData).length === 0) {
            const missingFields: string[] = [];
            if (!wine.rating) missingFields.push('rating');
            if (!wine.region) missingFields.push('region');
            if (!wine.country) missingFields.push('country');
            if (!wine.grapes || wine.grapes.length === 0) missingFields.push('grapes');
            if (!wine.regional_wine_style) missingFields.push('regional_wine_style');
            const reason = `Wine already has all data available from Vivino (missing locally: ${missingFields.join(', ') || 'none'})`;
            console.log(`[Batch Enrich] ⏭️ SKIP REASON: ${reason}`);
            console.log(`[Batch Enrich] Wine has - Rating: ${!!wine.rating}, Region: ${!!wine.region}, Grapes: ${wine.grapes?.length || 0}, Style: ${!!wine.regional_wine_style}`);
            progress.skipped++;
            addDetail(wine, 'skipped', { skip_reason: reason });
            continue;
          }

          const { error: updateError } = await supabaseClient
            .from("wines")
            .update(updateData)
            .eq("id", wine.id);

          if (updateError) {
            console.error(`[Batch Enrich] Error updating wine ${wine.id}:`, updateError);
            progress.failed++;
            progress.errors.push({ wine_id: wine.id, error: updateError.message });
            addDetail(wine, 'failed', { error: updateError.message });
          } else {
            console.log(`[Batch Enrich] ✅ Enriched ${wine.id} with:`, Object.keys(updateData).join(", "));
            progress.enriched++;
            addDetail(wine, 'enriched', { fields_updated: Object.keys(updateData) });
          }
        } catch (error) {
          console.error(`[Batch Enrich] Error processing wine ${wine.id}:`, error);
          const errMsg = error instanceof Error ? error.message : "Unknown error";
          progress.failed++;
          progress.errors.push({ wine_id: wine.id, error: errMsg });
          addDetail(wine, 'failed', { error: errMsg });
        }
      }
    }

    console.log(`[Batch Enrich] Completed:`, progress);

    return new Response(
      JSON.stringify({
        message: "Batch enrichment completed",
        progress,
        summary: {
          total: progress.total,
          enriched: progress.enriched,
          skipped: progress.skipped,
          failed: progress.failed,
          successRate: progress.total > 0 
            ? `${((progress.enriched / progress.total) * 100).toFixed(1)}%`
            : "0%",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Batch Enrich] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

