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
import { recommendCellar } from '../services/cellarAgent/orchestrator.js';

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
      console.log('[Sommelier] ====== REQUEST START ======');
      console.log('[Sommelier] Request body keys:', Object.keys(req.body));
      
      if (!openai) {
        console.error('[Sommelier] ERROR: OpenAI not configured');
        return res.status(503).json({ 
          error: 'OpenAI API key not configured. Sommelier is unavailable.' 
        });
      }

      const { message, history, cellarContext } = req.body;
      console.log('[Sommelier] Message:', message ? 'present' : 'MISSING');
      console.log('[Sommelier] CellarContext:', cellarContext ? 'present' : 'MISSING');

      if (!message || typeof message !== 'string') {
        console.error('[Sommelier] ERROR: Invalid message');
        return res.status(400).json({ error: 'Message is required' });
      }

      if (!cellarContext || !cellarContext.bottles || cellarContext.bottles.length === 0) {
        console.error('[Sommelier] ERROR: Invalid cellarContext');
        return res.status(400).json({ error: 'Cellar context is required' });
      }
      
      console.log('[Sommelier] ✓ Basic validation passed');

      console.log(`[Sommelier] ====== NEW REQUEST ======`);
      console.log(
        `[Sommelier] User ${req.userId?.substring(0, 8)} — cellar entries: ${cellarContext.bottles.length}`
      );

      const recommendation = await recommendCellar({
        openai,
        message,
        history: history || [],
        cellarBottles: cellarContext.bottles,
      });

      console.log('[Sommelier] ====== FINAL CHECK ======');
      console.log('[Sommelier] Recommendation exists:', !!recommendation);
      console.log(
        '[Sommelier] Recommendation type:',
        (recommendation as { type?: string })?.type || 'undefined'
      );

      if (!recommendation) {
        console.error('[Sommelier] ❌ ERROR: Failed to generate recommendation after all attempts');
        return res.status(500).json({
          error: 'Failed to generate valid recommendation',
        });
      }

      const duration = Date.now() - startTime;
      
      // Log minimal metrics (no PII, no full messages)
      console.log(`[Sommelier] ✓ Request completed successfully | user: ${req.userId?.substring(0, 8)}... | duration: ${duration}ms`);
      console.log('[Sommelier] ====== RETURNING RESPONSE ======');

      return res.json(recommendation);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[Sommelier] ====== CAUGHT EXCEPTION ======');
      console.error('[Sommelier] Error name:', error.name);
      console.error('[Sommelier] Error message:', error.message);
      console.error('[Sommelier] Error stack:', error.stack);
      console.error('[Sommelier] Duration:', duration, 'ms');
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
