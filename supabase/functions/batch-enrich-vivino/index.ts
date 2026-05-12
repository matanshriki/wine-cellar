import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

interface Wine {
  id: string;
  wine_name: string;
  producer: string;
  vintage?: number;
  vivino_url?: string;
  vivino_wine_id?: string;
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
  status: "enriched" | "skipped" | "failed";
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

/**
 * missing_only: Vivino URL + any core field null.
 * refresh_all: every wine with a Vivino URL.
 * search_missing_ids: wines where vivino_wine_id IS NULL — run search-vivino-wine to discover IDs.
 */
type EnrichmentScope = "missing_only" | "refresh_all" | "search_missing_ids";

// Rate limiting: 1 request per second (safe for Vivino, stays within Edge Function time limit)
const DELAY_BETWEEN_REQUESTS = 1000;
// Hard cap per invocation to stay well within Supabase's 150s wall-clock limit.
const MAX_PER_INVOCATION = 10;
const BATCH_SIZE = 10;

// ── search_missing_ids mode ────────────────────────────────────────────────────

async function handleSearchMissingIds(opts: {
  supabase: ReturnType<typeof createClient>;
  supabaseUrl: string;
  serviceRoleKey: string;
  dryRun: boolean;
  effectiveLimit: number;
  offset: number;
  corsHeaders: Record<string, string>;
}): Promise<Response> {
  const { supabase, supabaseUrl, serviceRoleKey, dryRun, effectiveLimit, offset, corsHeaders } = opts;

  // Fetch wines with no vivino_wine_id (Category B: search-only or no URL)
  const { data: wines, error: fetchError } = await supabase
    .from("wines")
    .select("id, wine_name, producer, vintage, vivino_url, vivino_wine_id, rating, region, country, grapes, regional_wine_style, user_id")
    .is("vivino_wine_id", null)
    .order("id")
    .range(offset, offset + effectiveLimit - 1);

  if (fetchError) {
    console.error("[Batch Enrich / search_missing_ids] Error fetching wines:", fetchError);
    return new Response(
      JSON.stringify({ error: "Failed to fetch wines", details: fetchError }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

  console.log(`[Batch Enrich / search_missing_ids] found ${progress.total} wines without vivino_wine_id (offset=${offset})`);

  if (dryRun) {
    return new Response(
      JSON.stringify({
        message: "Dry run completed",
        enrichment_scope: "search_missing_ids",
        progress,
        winesToProcess: wines?.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const addDetail = (wine: Wine, status: WineDetail["status"], opts: { skip_reason?: string; fields_updated?: string[]; error?: string } = {}) => {
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

  for (const wine of (wines ?? [])) {
    try {
      progress.processed++;
      console.log(`[Batch Enrich / search_missing_ids] [${progress.processed}/${progress.total}] ${wine.wine_name} (ID: ${wine.id})`);

      if (!wine.wine_name && !wine.producer) {
        progress.skipped++;
        addDetail(wine, "skipped", { skip_reason: "No wine_name or producer to search" });
        continue;
      }

      // Call search-vivino-wine to find the wine ID
      const searchResponse = await fetch(
        `${supabaseUrl}/functions/v1/search-vivino-wine`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            producer: wine.producer,
            wine_name: wine.wine_name,
            vintage: wine.vintage,
            region: wine.region,
          }),
        },
      );

      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));

      if (!searchResponse.ok) {
        const errText = await searchResponse.text();
        progress.failed++;
        progress.errors.push({ wine_id: wine.id, error: `search HTTP ${searchResponse.status}` });
        addDetail(wine, "failed", { error: `search HTTP ${searchResponse.status}: ${errText.slice(0, 100)}` });
        continue;
      }

      const searchData = await searchResponse.json();
      if (!searchData?.success || !searchData?.match?.wine_id) {
        progress.skipped++;
        addDetail(wine, "skipped", { skip_reason: "No confident Vivino match found" });
        continue;
      }

      const newWineId = searchData.match.wine_id;
      const canonicalUrl = `https://www.vivino.com/w/${newWineId}`;

      const updateData: Record<string, unknown> = {
        vivino_wine_id: newWineId,
        vivino_url: canonicalUrl,
      };

      const { error: updateError } = await supabase
        .from("wines")
        .update(updateData)
        .eq("id", wine.id);

      if (updateError) {
        console.error(`[Batch Enrich / search_missing_ids] Error updating wine ${wine.id}:`, updateError);
        progress.failed++;
        progress.errors.push({ wine_id: wine.id, error: updateError.message });
        addDetail(wine, "failed", { error: updateError.message });
      } else {
        console.log(`[Batch Enrich / search_missing_ids] ✅ ${wine.id}: vivino_wine_id=${newWineId}`);
        progress.enriched++;
        addDetail(wine, "enriched", { fields_updated: ["vivino_wine_id", "vivino_url"] });
      }
    } catch (error) {
      console.error(`[Batch Enrich / search_missing_ids] Error processing wine ${wine.id}:`, error);
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      progress.failed++;
      progress.errors.push({ wine_id: wine.id, error: errMsg });
      addDetail(wine, "failed", { error: errMsg });
    }
  }

  const has_more = progress.total === effectiveLimit;

  return new Response(
    JSON.stringify({
      message: "Search missing IDs completed",
      enrichment_scope: "search_missing_ids",
      has_more,
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
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: isAdmin } = await supabase.rpc("is_admin", { check_user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body.dryRun;
    const limit = typeof body.limit === "number" ? body.limit : MAX_PER_INVOCATION;
    const offset = typeof body.offset === "number" ? body.offset : 0;
    const enrichmentScope: EnrichmentScope = body.enrichment_scope === "refresh_all"
      ? "refresh_all"
      : body.enrichment_scope === "search_missing_ids"
      ? "search_missing_ids"
      : "missing_only";

    const effectiveLimit = Math.min(limit, MAX_PER_INVOCATION);

    // ── search_missing_ids mode: find wines with no vivino_wine_id and run search ──
    if (enrichmentScope === "search_missing_ids") {
      return await handleSearchMissingIds({ supabase, supabaseUrl, serviceRoleKey, dryRun, effectiveLimit, offset, corsHeaders });
    }

    let query = supabase
      .from("wines")
      .select(
        "id, wine_name, producer, vintage, vivino_url, vivino_wine_id, rating, region, country, grapes, regional_wine_style, user_id",
      )
      .not("vivino_url", "is", null)
      .order("id");

    if (enrichmentScope === "missing_only") {
      query = query.or(
        "rating.is.null,region.is.null,country.is.null,grapes.is.null,regional_wine_style.is.null",
      );
    }

    const { data: wines, error: fetchError } = await query.range(
      offset,
      offset + effectiveLimit - 1,
    );

    if (fetchError) {
      console.error("[Batch Enrich] Error fetching wines:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch wines", details: fetchError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    console.log(
      `[Batch Enrich] scope=${enrichmentScope} found ${progress.total} wines (offset=${offset})`,
    );

    if (dryRun) {
      return new Response(
        JSON.stringify({
          message: "Dry run completed",
          enrichment_scope: enrichmentScope,
          progress,
          winesToProcess: wines?.slice(0, 10),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const addDetail = (
      wine: Wine,
      status: WineDetail["status"],
      opts: { skip_reason?: string; fields_updated?: string[]; error?: string } = {},
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

    const buildUpdateData = (wine: Wine, wineData: Record<string, unknown>, vivinoWineId: string): Record<string, unknown> => {
      const updateData: Record<string, unknown> = {};
      const vivinoStyle = (wineData.wine_style ?? wineData.regional_wine_style) as string | undefined;

      // Always persist the vivino_wine_id (currently missing — extracted but never saved)
      if (!wine.vivino_wine_id) {
        updateData.vivino_wine_id = vivinoWineId;
      }

      if (enrichmentScope === "refresh_all") {
        if (typeof wineData.rating === "number") updateData.rating = wineData.rating;
        if (wineData.region && String(wineData.region).trim()) {
          updateData.region = String(wineData.region).trim();
        }
        if (wineData.country && String(wineData.country).trim()) {
          updateData.country = String(wineData.country).trim();
        }
        const g = wineData.grapes;
        if (Array.isArray(g) && g.length > 0) updateData.grapes = g;
        if (vivinoStyle && String(vivinoStyle).trim()) {
          updateData.regional_wine_style = String(vivinoStyle).trim();
        }
        return updateData;
      }

      // missing_only: only fill empty fields
      if (wineData.rating != null && typeof wineData.rating === "number" && wine.rating == null) {
        updateData.rating = wineData.rating;
      }
      if (wineData.region && !wine.region) updateData.region = wineData.region;
      if (wineData.country && !wine.country) updateData.country = wineData.country;
      if (wineData.grapes && Array.isArray(wineData.grapes) && (!wine.grapes || wine.grapes.length === 0)) {
        updateData.grapes = wineData.grapes;
      }
      if (vivinoStyle && !wine.regional_wine_style) {
        updateData.regional_wine_style = vivinoStyle;
      }
      return updateData;
    };

    for (let i = 0; i < (wines?.length || 0); i += BATCH_SIZE) {
      const batch = wines!.slice(i, i + BATCH_SIZE);
      console.log(`[Batch Enrich] Processing batch ${i / BATCH_SIZE + 1} (${batch.length} wines)`);

      for (const wine of batch) {
        try {
          progress.processed++;

          console.log(
            `[Batch Enrich] [${progress.processed}/${progress.total}] ${wine.wine_name} (ID: ${wine.id}) scope=${enrichmentScope}`,
          );

          const vivinoIdMatch = wine.vivino_url?.match(/\/w\/(\d+)/);
          if (!vivinoIdMatch) {
            const reason = `Invalid Vivino URL format: "${wine.vivino_url}"`;
            progress.skipped++;
            addDetail(wine, "skipped", { skip_reason: reason });
            continue;
          }

          const vivinoWineId = vivinoIdMatch[1];

          const vivinoResponse = await fetch(
            `${supabaseUrl}/functions/v1/fetch-vivino-data`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({ wine_id: vivinoWineId }),
            },
          );

          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));

          if (!vivinoResponse.ok) {
            const errorText = await vivinoResponse.text();
            const reason = `Vivino HTTP error ${vivinoResponse.status}: ${errorText.slice(0, 200)}`;
            progress.skipped++;
            addDetail(wine, "skipped", { skip_reason: reason });
            continue;
          }

          const vivinoData = await vivinoResponse.json();
          const wineData = (vivinoData.data || vivinoData) as Record<string, unknown>;

          const hasRating = typeof wineData.rating === "number";
          const hasRegion = !!(wineData.region && String(wineData.region).trim());
          const hasCountry = !!(wineData.country && String(wineData.country).trim());
          const hasGrapes = Array.isArray(wineData.grapes) && wineData.grapes.length > 0;
          const hasStyle = !!(wineData.wine_style || wineData.regional_wine_style);

          if (!hasRating && !hasRegion && !hasCountry && !hasGrapes && !hasStyle) {
            const reason =
              "Vivino returned no enrichable data (no rating, region, country, grapes, or style)";
            progress.skipped++;
            addDetail(wine, "skipped", { skip_reason: reason });
            continue;
          }

          const updateData = buildUpdateData(wine, wineData, vivinoWineId);

          if (Object.keys(updateData).length === 0) {
            const reason = enrichmentScope === "refresh_all"
              ? "Vivino returned no mappable fields to write"
              : "All target fields already populated locally; nothing to fill";
            progress.skipped++;
            addDetail(wine, "skipped", { skip_reason: reason });
            continue;
          }

          const { error: updateError } = await supabase
            .from("wines")
            .update(updateData)
            .eq("id", wine.id);

          if (updateError) {
            console.error(`[Batch Enrich] Error updating wine ${wine.id}:`, updateError);
            progress.failed++;
            progress.errors.push({ wine_id: wine.id, error: updateError.message });
            addDetail(wine, "failed", { error: updateError.message });
          } else {
            console.log(`[Batch Enrich] ✅ ${wine.id}:`, Object.keys(updateData).join(", "));
            progress.enriched++;
            addDetail(wine, "enriched", { fields_updated: Object.keys(updateData) });
          }
        } catch (error) {
          console.error(`[Batch Enrich] Error processing wine ${wine.id}:`, error);
          const errMsg = error instanceof Error ? error.message : "Unknown error";
          progress.failed++;
          progress.errors.push({ wine_id: wine.id, error: errMsg });
          addDetail(wine, "failed", { error: errMsg });
        }
      }
    }

    const has_more = progress.total === effectiveLimit;

    return new Response(
      JSON.stringify({
        message: "Batch enrichment completed",
        enrichment_scope: enrichmentScope,
        has_more,
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Batch Enrich] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
