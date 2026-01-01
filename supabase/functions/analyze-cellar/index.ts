/**
 * Bulk Cellar Analysis Edge Function
 * 
 * Generates sommelier notes for multiple bottles in one request.
 * Features:
 * - Rate limiting (max 20 bottles per request)
 * - Mode selection (missing_only, stale_only, all)
 * - Concurrent processing with error handling
 * - Idempotency (skips recently analyzed bottles)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_BOTTLES_PER_REQUEST = 20;
const CACHE_FRESHNESS_DAYS = 30;
const MAX_CONCURRENT = 3; // Process 3 bottles at a time

interface AnalysisRequest {
  mode: 'missing_only' | 'stale_only' | 'all';
  limit?: number;
}

interface BottleStatus {
  bottle_id: string;
  wine_name: string;
  status: 'success' | 'skipped' | 'failed';
  error?: string;
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    console.log('[Analyze Cellar] ========== REQUEST RECEIVED ==========');

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[Analyze Cellar] No auth header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for database operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user's JWT token
    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error('[Analyze Cellar] Auth failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Analyze Cellar] User authenticated:', user.id);

    // Parse request body
    const body: AnalysisRequest = await req.json();
    const mode = body.mode || 'missing_only';
    const limit = Math.min(body.limit || MAX_BOTTLES_PER_REQUEST, MAX_BOTTLES_PER_REQUEST);

    console.log('[Analyze Cellar] Mode:', mode, 'Limit:', limit);

    // Fetch user's bottles
    const { data: bottles, error: fetchError } = await supabaseAdmin
      .from('bottles')
      .select(`
        id,
        wine_id,
        analyzed_at,
        analysis_summary,
        readiness_label,
        wine:wines(
          wine_name,
          producer,
          vintage,
          region,
          grapes,
          color
        )
      `)
      .eq('user_id', user.id)
      .gt('quantity', 0); // Only bottles with quantity > 0

    if (fetchError) {
      console.error('[Analyze Cellar] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch bottles' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Analyze Cellar] Total bottles:', bottles?.length || 0);

    if (!bottles || bottles.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          results: [],
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter eligible bottles based on mode
    const eligibleBottles = bottles.filter((bottle: any) => {
      if (mode === 'missing_only') {
        // Only bottles without analysis
        return !bottle.analysis_summary || !bottle.readiness_label;
      } else if (mode === 'stale_only') {
        // Only bottles with stale analysis (> 30 days)
        if (!bottle.analyzed_at) return true;
        const daysSince = (Date.now() - new Date(bottle.analyzed_at).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > CACHE_FRESHNESS_DAYS;
      } else {
        // all mode - analyze everything
        return true;
      }
    }).slice(0, limit);

    console.log('[Analyze Cellar] Eligible bottles:', eligibleBottles.length);

    if (eligibleBottles.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processedCount: 0,
          skippedCount: bottles.length,
          failedCount: 0,
          results: [],
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process bottles with concurrency control
    const results: BottleStatus[] = [];
    const chunks: any[][] = [];
    
    // Split into chunks for concurrent processing
    for (let i = 0; i < eligibleBottles.length; i += MAX_CONCURRENT) {
      chunks.push(eligibleBottles.slice(i, i + MAX_CONCURRENT));
    }

    console.log('[Analyze Cellar] Processing', chunks.length, 'chunks');

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((bottle: any) => analyzeBottle(bottle, supabaseAdmin))
      );
      results.push(...chunkResults);
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    console.log('[Analyze Cellar] ========== COMPLETE ==========');
    console.log('[Analyze Cellar] Success:', successCount, 'Failed:', failedCount, 'Skipped:', skippedCount);

    return new Response(
      JSON.stringify({
        success: true,
        processedCount: successCount,
        skippedCount: skippedCount + (bottles.length - eligibleBottles.length),
        failedCount: failedCount,
        results: results,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Analyze Cellar] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Analyze a single bottle
 */
async function analyzeBottle(bottle: any, supabase: any): Promise<BottleStatus> {
  try {
    console.log('[Analyze Cellar] Processing:', bottle.wine.wine_name);

    // Call OpenAI for analysis
    const wineInfo = {
      wine_name: bottle.wine.wine_name,
      producer: bottle.wine.producer,
      vintage: bottle.wine.vintage,
      region: bottle.wine.region,
      grapes: Array.isArray(bottle.wine.grapes) ? bottle.wine.grapes.join(', ') : '',
      color: bottle.wine.color,
    };

    const analysis = await generateAIAnalysis(wineInfo);

    // Store results in database
    const updateData = {
      analysis_summary: analysis.analysis_summary,
      analysis_reasons: analysis.analysis_reasons,
      readiness_label: analysis.readiness_label,
      readiness_status: mapReadinessLabel(analysis.readiness_label),
      readiness_score: mapReadinessScore(analysis.readiness_label),
      serve_temp_c: analysis.serving_temp_c,
      decant_minutes: analysis.decant_minutes,
      drink_window_start: analysis.drink_window_start,
      drink_window_end: analysis.drink_window_end,
      confidence: analysis.confidence,
      assumptions: analysis.assumptions,
      analyzed_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('bottles')
      .update(updateData)
      .eq('id', bottle.id);

    if (updateError) {
      console.error('[Analyze Cellar] Update failed:', bottle.id, updateError);
      return {
        bottle_id: bottle.id,
        wine_name: bottle.wine.wine_name,
        status: 'failed',
        error: 'Database update failed',
      };
    }

    console.log('[Analyze Cellar] ✅ Success:', bottle.wine.wine_name);

    return {
      bottle_id: bottle.id,
      wine_name: bottle.wine.wine_name,
      status: 'success',
    };

  } catch (error: any) {
    console.error('[Analyze Cellar] Analysis failed:', bottle.id, error);
    return {
      bottle_id: bottle.id,
      wine_name: bottle.wine.wine_name,
      status: 'failed',
      error: error.message || 'Analysis failed',
    };
  }
}

/**
 * Generate AI analysis using OpenAI
 */
async function generateAIAnalysis(wineInfo: any): Promise<any> {
  if (!OPENAI_API_KEY) {
    console.warn('[Analyze Cellar] No OpenAI API key, using fallback');
    return generateFallbackAnalysis(wineInfo);
  }

  try {
    const prompt = `As an expert sommelier, analyze this wine and provide detailed tasting notes and recommendations.

Wine Details:
- Name: ${wineInfo.wine_name}
- Producer: ${wineInfo.producer || 'Unknown'}
- Vintage: ${wineInfo.vintage || 'NV'}
- Region: ${wineInfo.region || 'Unknown'}
- Grapes: ${wineInfo.grapes || 'Unknown'}
- Color: ${wineInfo.color}

Provide a JSON response with:
- analysis_summary: A 2-3 sentence sommelier's note about this wine
- analysis_reasons: Array of 3-4 bullet points explaining the analysis
- readiness_label: "READY", "HOLD", or "PEAK_SOON"
- serving_temp_c: Optimal serving temperature in Celsius
- decant_minutes: Recommended decanting time in minutes
- drink_window_start: Year to start drinking (null if ready now)
- drink_window_end: Year to drink by (null if no specific window)
- confidence: "LOW", "MEDIUM", or "HIGH"
- assumptions: Any assumptions made (or null)

Focus on practical advice, elegance, and luxury. Be concise but insightful.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert sommelier providing professional wine analysis.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('[Analyze Cellar] OpenAI error:', response.status);
      return generateFallbackAnalysis(wineInfo);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const analysis = JSON.parse(content);

    return analysis;

  } catch (error) {
    console.error('[Analyze Cellar] OpenAI failed, using fallback:', error);
    return generateFallbackAnalysis(wineInfo);
  }
}

/**
 * Fallback deterministic analysis
 */
function generateFallbackAnalysis(wineInfo: any): any {
  const currentYear = new Date().getFullYear();
  const age = wineInfo.vintage ? currentYear - wineInfo.vintage : 0;
  const color = wineInfo.color || 'red';

  let readinessLabel = 'READY';
  let servingTemp = 16;
  let decantMinutes = 30;
  let summary = `This ${wineInfo.wine_name} is ready to enjoy.`;
  let reasons = ['Based on age and type', 'Suitable for current consumption'];
  let confidence = 'MEDIUM';

  if (color === 'red' && age < 3) {
    readinessLabel = 'HOLD';
    summary = `This ${wineInfo.wine_name} is still young and would benefit from additional aging.`;
    reasons = ['Young red wine', 'Tannins still developing', 'Consider aging 2-5 more years'];
  } else if (color === 'red' && age >= 3 && age < 10) {
    readinessLabel = 'READY';
    summary = `This ${wineInfo.wine_name} is in its prime drinking window with excellent balance.`;
    reasons = ['Optimal maturity', 'Well-integrated tannins', 'Complex aromatics'];
  } else if (color === 'white' || color === 'rose') {
    servingTemp = color === 'white' ? 10 : 12;
    decantMinutes = 0;
    readinessLabel = 'READY';
    summary = `This ${wineInfo.wine_name} is ready to enjoy with bright, fresh characteristics.`;
    reasons = ['Fresh and vibrant', 'Ideal serving temperature', 'No decanting needed'];
  } else if (color === 'sparkling') {
    servingTemp = 6;
    decantMinutes = 0;
    readinessLabel = 'READY';
    summary = `This ${wineInfo.wine_name} is ready to enjoy chilled.`;
    reasons = ['Sparkling wines best enjoyed young', 'Serve well-chilled', 'No decanting'];
  }

  return {
    analysis_summary: summary,
    analysis_reasons: reasons,
    readiness_label: readinessLabel,
    serving_temp_c: servingTemp,
    decant_minutes: decantMinutes,
    drink_window_start: null,
    drink_window_end: null,
    confidence: confidence,
    assumptions: 'Analysis based on general wine aging principles.',
  };
}

function mapReadinessLabel(label: string): string {
  switch (label) {
    case 'READY': return 'InWindow';
    case 'PEAK_SOON': return 'Approaching';
    case 'HOLD': return 'TooYoung';
    default: return 'Unknown';
  }
}

function mapReadinessScore(label: string): number {
  switch (label) {
    case 'READY': return 90;
    case 'PEAK_SOON': return 75;
    case 'HOLD': return 60;
    default: return 50;
  }
}

