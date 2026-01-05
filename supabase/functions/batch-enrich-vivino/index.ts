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
  grapes?: string[];
  user_id: string;
}

interface BatchProgress {
  total: number;
  processed: number;
  enriched: number;
  failed: number;
  skipped: number;
  errors: Array<{ wine_id: string; error: string }>;
}

// Rate limiting: 1 request per 2 seconds (30 per minute to be safe)
const DELAY_BETWEEN_REQUESTS = 2000;
const BATCH_SIZE = 50; // Process 50 wines at a time

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: isAdminData, error: adminCheckError } = await supabaseClient
      .rpc("is_admin", { check_user_id: user.id });

    if (adminCheckError) {
      console.error("[Batch Enrich] Admin check error:", adminCheckError);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isAdminData) {
      console.log(`[Batch Enrich] Access denied for non-admin user: ${user.id}`);
      return new Response(
        JSON.stringify({ 
          error: "Admin access required",
          message: "Only admin users can run batch enrichment" 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Batch Enrich] Started by admin user: ${user.id}`);

    // Parse request options
    const { dryRun = false, limit = 1000 } = await req.json().catch(() => ({}));

    // Fetch all wines that need enrichment
    // Criteria: Have vivino_url but missing other data (rating, region, or grapes)
    const { data: wines, error: fetchError } = await supabaseClient
      .from("wines")
      .select("id, wine_name, producer, vintage, vivino_url, rating, region, grapes, user_id")
      .not("vivino_url", "is", null)
      .or("rating.is.null,region.is.null,grapes.is.null")
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
    };

    console.log(`[Batch Enrich] Found ${progress.total} wines to process`);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          message: "Dry run completed",
          progress,
          winesToProcess: wines?.slice(0, 10), // Show first 10 as sample
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process wines in batches
    for (let i = 0; i < (wines?.length || 0); i += BATCH_SIZE) {
      const batch = wines!.slice(i, i + BATCH_SIZE);
      console.log(`[Batch Enrich] Processing batch ${i / BATCH_SIZE + 1} (${batch.length} wines)`);

      for (const wine of batch) {
        try {
          progress.processed++;

          console.log(`[Batch Enrich] [${progress.processed}/${progress.total}] Processing: ${wine.wine_name} (ID: ${wine.id})`);

          // Extract wine_id from vivino_url
          const vivinoIdMatch = wine.vivino_url?.match(/\/w\/(\d+)/);
          if (!vivinoIdMatch) {
            console.log(`[Batch Enrich] Skipping ${wine.id}: Invalid Vivino URL format`);
            progress.skipped++;
            continue;
          }

          const vivinoWineId = vivinoIdMatch[1];

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

          if (!vivinoResponse.ok) {
            console.log(`[Batch Enrich] Skipping ${wine.id}: Vivino data not found`);
            progress.skipped++;
            continue;
          }

          const vivinoData = await vivinoResponse.json();

          // Check if we got valid data
          if (!vivinoData.rating && !vivinoData.region && !vivinoData.grapes) {
            console.log(`[Batch Enrich] Skipping ${wine.id}: No enrichable data found`);
            progress.skipped++;
            continue;
          }

          // Update wine with Vivino data (only update missing fields)
          const updateData: any = {};
          if (vivinoData.rating && !wine.rating) updateData.rating = vivinoData.rating;
          if (vivinoData.region && !wine.region) updateData.region = vivinoData.region;
          if (vivinoData.grapes && (!wine.grapes || wine.grapes.length === 0)) {
            updateData.grapes = vivinoData.grapes;
          }
          // Additional fields
          if (vivinoData.wine_type && !wine.wine_type) updateData.wine_type = vivinoData.wine_type;
          if (vivinoData.price && !wine.price) updateData.price = vivinoData.price;
          if (vivinoData.alcohol_content && !wine.alcohol_content) {
            updateData.alcohol_content = vivinoData.alcohol_content;
          }

          // Only update if we have new data
          if (Object.keys(updateData).length === 0) {
            console.log(`[Batch Enrich] Skipping ${wine.id}: No new data to add`);
            progress.skipped++;
            continue;
          }

          const { error: updateError } = await supabaseClient
            .from("wines")
            .update(updateData)
            .eq("id", wine.id);

          if (updateError) {
            console.error(`[Batch Enrich] Error updating wine ${wine.id}:`, updateError);
            progress.failed++;
            progress.errors.push({
              wine_id: wine.id,
              error: updateError.message,
            });
          } else {
            console.log(`[Batch Enrich] ✅ Enriched ${wine.id} with:`, Object.keys(updateData).join(", "));
            progress.enriched++;
          }
        } catch (error) {
          console.error(`[Batch Enrich] Error processing wine ${wine.id}:`, error);
          progress.failed++;
          progress.errors.push({
            wine_id: wine.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
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

