/**
 * Cellar Sommelier Routes (Production-Ready)
 * 
 * API endpoints for the Cellar Sommelier AI chat assistant.
 * Protected by feature flags and rate limiting.
 */

import { Router } from 'express';
import { type AuthRequest } from '../middleware/auth.js';
import { config } from '../config.js';
import OpenAI from 'openai';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

export const agentRouter = Router();

// Multer for audio upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Initialize OpenAI client
const openai = config.openaiApiKey 
  ? new OpenAI({ apiKey: config.openaiApiKey })
  : null;

// Initialize Supabase client for feature flag checks
const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;

// Rate limiting: In-memory store (simple implementation)
// Note: This is per-instance. For multi-instance production, use Redis or database.
interface RateLimitEntry {
  count: number;
  resetAt: Date;
}
const rateLimitStore = new Map<string, RateLimitEntry>();
const DAILY_LIMIT = 30;

/**
 * Middleware: Authenticate with Supabase JWT
 * Production version - requires valid authentication
 */
async function authenticateProduction(req: AuthRequest, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  if (!supabase) {
    console.error('[Sommelier] Supabase not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('[Sommelier] Auth error:', error?.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.userId = user.id;
    next();
  } catch (error: any) {
    console.error('[Sommelier] Auth exception:', error.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware: Check feature flag
 * Fetches user profile and verifies cellar_agent_enabled
 * Uses the user's JWT token to bypass RLS
 */
async function checkFeatureFlag(req: AuthRequest, res: any, next: any) {
  try {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      console.error('[Sommelier] Supabase not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Get the user's JWT token from the request header
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      console.error('[Sommelier] No token provided for feature flag check');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Create a Supabase client with the user's token (bypasses RLS)
    const userSupabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: profile, error } = await userSupabase
      .from('profiles')
      .select('cellar_agent_enabled')
      .eq('id', req.userId)
      .single();

    if (error) {
      console.error('[Sommelier] Profile fetch error:', error.message);
      return res.status(500).json({ error: 'Failed to check feature access' });
    }

    if (!profile || !profile.cellar_agent_enabled) {
      console.log(`[Sommelier] Feature disabled for user: ${req.userId?.substring(0, 8)}...`);
      return res.status(403).json({ error: 'Sommelier not enabled for your account' });
    }

    next();
  } catch (error: any) {
    console.error('[Sommelier] Feature flag check error:', error.message);
    return res.status(500).json({ error: 'Failed to check feature access' });
  }
}

/**
 * Middleware: Rate limiting
 * Limit to DAILY_LIMIT requests per user per day
 */
function rateLimit(req: AuthRequest, res: any, next: any) {
  const userId = req.userId!;
  const now = new Date();
  
  let entry = rateLimitStore.get(userId);
  
  // Reset if past midnight
  if (entry && entry.resetAt < now) {
    entry = undefined;
    rateLimitStore.delete(userId);
  }
  
  if (!entry) {
    // Create new entry for today
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    
    entry = {
      count: 0,
      resetAt: tomorrow,
    };
    rateLimitStore.set(userId, entry);
  }
  
  if (entry.count >= DAILY_LIMIT) {
    console.log(`[Sommelier] Rate limit exceeded for user: ${userId.substring(0, 8)}...`);
    return res.status(429).json({ 
      error: 'Daily limit reached. Try again tomorrow.',
      limit: DAILY_LIMIT,
      resetAt: entry.resetAt.toISOString(),
    });
  }
  
  entry.count++;
  next();
}

/**
 * Build cellar context for OpenAI
 * Limits to 50 bottles max to control token usage
 * 
 * NOTE: Frontend already sends flattened bottle structure
 */
function buildCellarContext(bottles: any[]) {
  // Separate bottles by readiness for smart randomization
  const readyBottles = bottles.filter(
    b => b.readinessStatus === 'ready' || b.readinessStatus === 'peak'
  );
  const otherBottles = bottles.filter(
    b => b.readinessStatus !== 'ready' && b.readinessStatus !== 'peak'
  );

  // Shuffle function for variety
  const shuffle = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Shuffle within each category for variety, but prioritize ready bottles
  const shuffledReady = shuffle(readyBottles);
  const shuffledOthers = shuffle(otherBottles);
  
  // Combine: ready bottles first (shuffled), then others (shuffled)
  const sorted = [...shuffledReady, ...shuffledOthers];

  const limited = sorted.slice(0, 50);
  
  // Bottles are already in flat format from frontend
  const compactBottles = limited.map(b => ({
    id: b.id,
    producer: b.producer || 'Unknown',
    wineName: b.wineName || 'Unknown',
    vintage: b.vintage,
    region: b.region,
    country: b.country,
    grapes: b.grapes,
    color: b.color,
    drinkWindowStart: b.drinkWindowStart,
    drinkWindowEnd: b.drinkWindowEnd,
    readinessStatus: b.readinessStatus,
    notes: b.notes?.substring(0, 200), // Limit notes to 200 chars
    quantity: b.quantity,
  }));

  // Calculate total physical bottles (sum of quantities, not just entries)
  const totalPhysicalBottles = bottles.reduce((sum, b) => sum + (b.quantity || 1), 0);
  const limitedPhysicalBottles = limited.reduce((sum, b) => sum + (b.quantity || 1), 0);

  let summary = '';
  if (bottles.length > 50) {
    const remaining = totalPhysicalBottles - limitedPhysicalBottles;
    const colorCounts = bottles.reduce((acc, b) => {
      const color = b.color || 'unknown';
      acc[color] = (acc[color] || 0) + (b.quantity || 1);
      return acc;
    }, {} as Record<string, number>);
    
    summary = `\n\nNote: Showing ${limitedPhysicalBottles} bottles. You have ${remaining} more bottles in cellar (${Object.entries(colorCounts).map(([c, n]) => `${n} ${c}`).join(', ')}).`;
  }

  return { bottles: compactBottles, summary, totalBottles: totalPhysicalBottles };
}

/**
 * POST /api/agent/recommend
 * 
 * Get AI recommendation from user's cellar
 * Body: { message, history, cellarContext }
 */
agentRouter.post(
  '/recommend', 
  authenticateProduction, 
  checkFeatureFlag, 
  rateLimit,
  async (req: AuthRequest, res) => {
    const startTime = Date.now();
    
    try {
      if (!openai) {
        return res.status(503).json({ 
          error: 'OpenAI API key not configured. Sommelier is unavailable.' 
        });
      }

      const { message, history, cellarContext } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (!cellarContext || !cellarContext.bottles || cellarContext.bottles.length === 0) {
        return res.status(400).json({ error: 'Cellar context is required' });
      }

      // Build limited cellar context
      const { bottles, summary } = buildCellarContext(cellarContext.bottles);
      
      // Debug: Log sample of what we're sending to OpenAI
      console.log(`[Sommelier] User ${req.userId?.substring(0, 8)} - Sending ${bottles.length} bottles to OpenAI`);
      console.log(`[Sommelier] Sample bottle:`, bottles[0]);

      // Build conversation history (limit to last 8 messages)
      const conversationHistory = (history || []).slice(-8);

      // Call OpenAI with strict JSON response
      let attempt = 0;
      const maxAttempts = 2;
      let recommendation = null;

      while (attempt < maxAttempts && !recommendation) {
        attempt++;

        try {
          // Import sommelier knowledge
          const { getSommelierSystemPrompt } = await import('../services/sommelierKnowledge.js');
          
          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `${getSommelierSystemPrompt()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CELLAR AGENT SPECIFIC RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are assisting a user in a conversational interface. Apply all sommelier knowledge above, PLUS:

**STRICT CONSTRAINTS:**
1. You can ONLY recommend wines by their bottleId from the user's cellar list below
2. NEVER invent or suggest wines not in the list
3. If the request is impossible (e.g., "white wine" but only reds available), explain politely and suggest the closest alternative FROM THE CELLAR

**CONVERSATIONAL APPROACH:**
- Be warm, friendly, and knowledgeable
- Ask clarifying questions if needed (e.g., "Are you serving beef or pork with that steak?")
- VARIETY IS IMPORTANT: When similar questions are asked multiple times, recommend different bottles to help explore the cellar

**RESPONSE FORMAT:**

FIRST, analyze the user's request:
- If they ask for MULTIPLE bottles (e.g., "top 5", "3 recommendations", "several wines"), use the MULTI-BOTTLE format
- If they ask for ONE bottle or it's unclear, use the SINGLE-BOTTLE format
- Extract the requested count N from phrases like: "top N", "N bottles", "N recommendations", "best N", etc.
- Default to 3 if a multi-bottle request doesn't specify a number

**SINGLE-BOTTLE FORMAT** (for single recommendations):
{
  "type": "single",
  "message": "Your warm, knowledgeable response (2-4 sentences)",
  "recommendation": {
    "bottleId": "the exact ID from the cellar list",
    "reason": "Deep sommelier reasoning WHY this bottle works (4-6 sentences using wine science, terroir, structure, aging, pairing principles)",
    "serveTemp": "Specific serving temperature (e.g., '16-18°C (60-64°F)')",
    "decant": "Decanting guidance (e.g., 'Decant for 1-2 hours' or 'No decanting needed')"
  },
  "followUpQuestion": "Optional clarifying question if you need more context (omit if not needed)"
}

**MULTI-BOTTLE FORMAT** (for multiple recommendations):
{
  "type": "bottle_list",
  "title": "Top N Bottles in Your Cellar" (or similar descriptive title),
  "message": "Brief intro explaining the selection (1-2 sentences)",
  "bottles": [
    {
      "bottleId": "exact ID from cellar",
      "name": "wine name",
      "producer": "producer name",
      "vintage": vintage number or null,
      "region": "region name" or null,
      "rating": rating number or null,
      "readinessStatus": "ready/peak/aging/drink_soon" or null,
      "serveTempC": temperature number or null,
      "decantMinutes": minutes number or null,
      "shortWhy": "One sentence explaining why this bottle (max 100 chars)"
    }
  ],
  "followUpQuestion": "Optional clarifying question (omit if not needed)"
}

**IMPORTANT:**
- For multi-bottle requests, return exactly N bottles (or fewer if cellar doesn't have enough)
- Order bottles by quality/appropriateness (best first)
- Each "shortWhy" should be unique and specific to that bottle
- If you need clarification, set "followUpQuestion" and OMIT "recommendation" or "bottles"
- Your reasoning should demonstrate deep wine knowledge, not generic statements
- Reference specific wine characteristics: grape variety, region, aging status, structure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER'S CELLAR (COMPLETE LIST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${JSON.stringify(bottles, null, 2)}

${summary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Remember: Think like a knowledgeable sommelier, not a rule-following machine.`
              },
              ...conversationHistory.map((msg: any) => ({
                role: msg.role,
                content: msg.content,
              })),
              {
                role: 'user',
                content: message,
              }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.8, // Higher temperature for more variety in recommendations
          });

          const content = response.choices[0]?.message?.content;
          if (!content) {
            throw new Error('Empty response from OpenAI');
          }

          const parsed = JSON.parse(content);

          // Validate response format
          if (parsed.type === 'bottle_list') {
            // Multi-bottle response
            if (!parsed.bottles || !Array.isArray(parsed.bottles)) {
              throw new Error('Invalid bottle_list response: missing bottles array');
            }

            // Validate all bottle IDs exist in cellar
            const invalidBottles = parsed.bottles.filter((b: any) => 
              !bottles.some((cellarBottle: any) => cellarBottle.id === b.bottleId)
            );

            if (invalidBottles.length > 0) {
              console.warn('[Sommelier] Invalid bottleIds in list, retrying');
              
              if (attempt < maxAttempts) {
                continue; // Retry
              }
            }

            recommendation = parsed;
          } else {
            // Single-bottle response (type: "single" or legacy format)
            if (parsed.recommendation && parsed.recommendation.bottleId) {
              const bottleExists = bottles.some((b: any) => b.id === parsed.recommendation.bottleId);
              
              if (!bottleExists) {
                console.warn('[Sommelier] Invalid bottleId, retrying with corrective instruction');
                
                if (attempt < maxAttempts) {
                // Retry with correction
                continue;
              } else {
                // Give up, return safe failure
                recommendation = {
                  message: "I couldn't confidently pick a bottle from your cellar. Could you rephrase your request or be more specific?",
                };
              }
            } else {
              recommendation = parsed;
            }
          } else {
            // No recommendation (probably a clarifying question)
            recommendation = parsed;
          }
          }
        } catch (parseError: any) {
          console.error('[Sommelier] Parse error:', parseError.message);
          
          if (attempt >= maxAttempts) {
            return res.status(500).json({ 
              error: 'Failed to generate valid recommendation' 
            });
          }
        }
      }

      const duration = Date.now() - startTime;
      
      // Log minimal metrics (no PII, no full messages)
      console.log(`[Sommelier] Request completed | user: ${req.userId?.substring(0, 8)}... | duration: ${duration}ms | success: ${!!recommendation}`);

      return res.json(recommendation);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[Sommelier] Error:', error.message, `| duration: ${duration}ms`);
      return res.status(500).json({ 
        error: 'Failed to generate recommendation. Please try again.' 
      });
    }
  }
);

/**
 * POST /api/agent/transcribe
 * 
 * Transcribe audio to text using OpenAI Whisper
 * Body: multipart/form-data with 'audio' field
 */
agentRouter.post(
  '/transcribe', 
  authenticateProduction, 
  checkFeatureFlag, 
  upload.single('audio'), 
  async (req: AuthRequest, res) => {
    const startTime = Date.now();
    
    try {
      if (!openai) {
        return res.status(503).json({ error: 'OpenAI not configured' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      // Create File object from buffer
      const audioFile = new File([req.file.buffer], 'audio.webm', {
        type: req.file.mimetype,
      });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
      });

      const duration = Date.now() - startTime;
      console.log(`[Sommelier] Transcription | user: ${req.userId?.substring(0, 8)}... | duration: ${duration}ms`);

      return res.json({ text: transcription.text });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[Sommelier] Transcription error:', error.message, `| duration: ${duration}ms`);
      return res.status(500).json({ 
        error: 'Failed to transcribe audio' 
      });
    }
  }
);
