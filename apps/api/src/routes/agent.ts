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
  // Sort by readiness and recency
  const sorted = [...bottles].sort((a, b) => {
    // Prioritize bottles that are ready to drink
    const aReady = a.readinessStatus === 'ready' || a.readinessStatus === 'peak';
    const bReady = b.readinessStatus === 'ready' || b.readinessStatus === 'peak';
    if (aReady && !bReady) return -1;
    if (!aReady && bReady) return 1;
    
    // Then by vintage (older first for aged wines)
    if (a.vintage && b.vintage) {
      return a.vintage - b.vintage;
    }
    
    return 0;
  });

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

  let summary = '';
  if (bottles.length > 50) {
    const remaining = bottles.length - 50;
    const colorCounts = bottles.reduce((acc, b) => {
      const color = b.color || 'unknown';
      acc[color] = (acc[color] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    summary = `\n\nNote: Showing top 50 bottles. You have ${remaining} more bottles (${Object.entries(colorCounts).map(([c, n]) => `${n} ${c}`).join(', ')}).`;
  }

  return { bottles: compactBottles, summary };
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
          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `You are a professional sommelier assistant. You MUST recommend wines ONLY from the user's cellar list provided below.

STRICT RULES:
1. You can ONLY recommend a wine by its bottleId from the list below
2. If the request is impossible (e.g., user asks for white wine but only has red), explain politely and suggest the closest alternative FROM THE CELLAR
3. Output MUST be valid JSON matching this exact schema:
{
  "message": "your friendly response text",
  "recommendation": {
    "bottleId": "the ID from the list",
    "reason": "why this bottle",
    "serveTemp": "serving temperature (optional)",
    "decant": "decanting suggestion (optional)"
  },
  "followUpQuestion": "optional clarifying question if needed"
}

USER'S CELLAR:
${JSON.stringify(bottles, null, 2)}
${summary}

If you need to ask a clarifying question, set followUpQuestion and omit recommendation.
Always be warm, knowledgeable, and concise.`
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
            temperature: 0.7,
          });

          const content = response.choices[0]?.message?.content;
          if (!content) {
            throw new Error('Empty response from OpenAI');
          }

          const parsed = JSON.parse(content);

          // Validate recommendedBottleId exists in cellar
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
