/**
 * Admin-only: rule-based wine metadata enrichment (grapes / regional_wine_style).
 * No Vivino calls — uses shared heuristics in _shared/wineEnrichment.ts.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import {
  planWineMetadataEnrichment,
  rowNeedsEnrichmentAttention,
  parseGrapesField,
  WINE_METADATA_ENRICHMENT_VERSION,
  type EnrichmentBackfillFilterMode,
  type WineEnrichmentRow,
} from "../_shared/wineEnrichment.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type WineRow = {
  id: string;
  user_id: string;
  producer: string;
  wine_name: string;
  vintage: number | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  regional_wine_style: string | null;
  color: string;
  grapes: unknown;
  entry_source: string | null;
};

type DetailRow = {
  wine_id: string;
  producer: string;
  wine_name: string;
  vintage: number | null;
  region: string | null;
  country: string | null;
  status: "updated" | "would_update" | "skipped";
  rule_id: string | null;
  confidence: number;
  suspicion_flagged: boolean;
  suspicion_reasons: string[];
  before_grapes: string[] | null;
  after_grapes: string[] | null;
  before_style: string | null;
  after_style: string | null;
  log_lines: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await adminClient.rpc("is_admin", {
      check_user_id: user.id,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;
    const offset = Math.max(0, parseInt(String(body.offset ?? "0"), 10) || 0);
    const batchSize = Math.min(80, Math.max(5, parseInt(String(body.batchSize ?? "40"), 10) || 40));
    const filterMode = (body.filterMode ?? "candidates") as EnrichmentBackfillFilterMode;
    if (!["candidates", "missing_grapes", "suspicious"].includes(filterMode)) {
      return new Response(JSON.stringify({ error: "Invalid filterMode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(
      `[batch-enrich-wine-rules] dryRun=${dryRun} offset=${offset} batch=${batchSize} filter=${filterMode} admin=${user.id}`,
    );

    const { data: wines, error: fetchError } = await adminClient
      .from("wines")
      .select(
        "id, user_id, producer, wine_name, vintage, country, region, appellation, regional_wine_style, color, grapes, entry_source",
      )
      .order("id", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    const rows = (wines ?? []) as WineRow[];
    const isComplete = rows.length < batchSize;
    const nextOffset = offset + rows.length;

    const details: DetailRow[] = [];
    let examined = 0;
    let ineligibleFilter = 0;
    let noChange = 0;
    let mutations = 0;

    for (const w of rows) {
      const input: WineEnrichmentRow = {
        producer: w.producer,
        wine_name: w.wine_name,
        vintage: w.vintage,
        country: w.country,
        region: w.region,
        appellation: w.appellation,
        regional_wine_style: w.regional_wine_style,
        color: w.color,
        grapes: w.grapes,
        entry_source: w.entry_source,
      };

      if (!rowNeedsEnrichmentAttention(input, filterMode)) {
        ineligibleFilter++;
        continue;
      }

      examined++;
      const beforeGrapes = parseGrapesField(w.grapes);
      const beforeStyle = w.regional_wine_style;

      const plan = planWineMetadataEnrichment(input);

      if (!plan.hasUpdates) {
        noChange++;
        continue;
      }

      const afterGrapes = plan.updates.grapes ?? beforeGrapes;
      const afterStyle = plan.updates.regional_wine_style ?? beforeStyle;

      const detail: DetailRow = {
        wine_id: w.id,
        producer: w.producer,
        wine_name: w.wine_name,
        vintage: w.vintage,
        region: w.region,
        country: w.country,
        status: dryRun ? "would_update" : "updated",
        rule_id: plan.matchedRuleId,
        confidence: plan.confidence,
        suspicion_flagged: plan.suspicion.flagged,
        suspicion_reasons: plan.suspicion.reasons,
        before_grapes: beforeGrapes.length ? [...beforeGrapes] : null,
        after_grapes: afterGrapes.length ? [...afterGrapes] : null,
        before_style: beforeStyle,
        after_style: afterStyle ?? null,
        log_lines: [...plan.logLines],
      };

      if (dryRun) {
        details.push({ ...detail, status: "would_update" });
        mutations++;
        continue;
      }

      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (plan.updates.grapes !== undefined) patch.grapes = plan.updates.grapes;
      if (plan.updates.regional_wine_style !== undefined) {
        patch.regional_wine_style = plan.updates.regional_wine_style;
      }

      const { error: upErr } = await adminClient.from("wines").update(patch).eq("id", w.id);
      if (upErr) {
        console.error(`[batch-enrich-wine-rules] update failed ${w.id}:`, upErr);
        details.push({
          ...detail,
          status: "skipped",
          log_lines: [...detail.log_lines, `DB error: ${upErr.message}`],
        });
        continue;
      }

      mutations++;
      details.push({ ...detail, status: "updated" });
      console.log(
        `[batch-enrich-wine-rules] updated wine=${w.id} rule=${plan.matchedRuleId} grapes=${JSON.stringify(plan.updates.grapes)}`,
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        filterMode,
        enrichmentVersion: WINE_METADATA_ENRICHMENT_VERSION,
        offset,
        nextOffset,
        isComplete,
        batchSizeRequested: batchSize,
        rowsFetched: rows.length,
        examined,
        ineligibleFilter,
        noChange,
        updatedOrWouldUpdate: mutations,
        details,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[batch-enrich-wine-rules] fatal:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Internal error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
