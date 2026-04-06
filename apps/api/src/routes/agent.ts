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
import { saveSommelierFeedback } from '../services/cellarAgent/sommelierActions.js';
import { updateRecommendationOutcome } from '../services/cellarAgent/sommelierRepo.js';
import type { RecommendationOutcome } from '../services/cellarAgent/sommelierTypes.js';
import { processAiCreditUsage, checkCreditBalance } from '../services/creditService.js';

export const agentRouter = Router();

function createUserSupabase(req: AuthRequest) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !config.supabaseUrl || !config.supabaseAnonKey) return null;
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

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
      if (!openai) {
        console.error('[Sommelier]', JSON.stringify({ phase: 'config', error: 'openai_missing' }));
        return res.status(503).json({ 
          error: 'OpenAI API key not configured. Sommelier is unavailable.' 
        });
      }

      const { message, history, cellarContext, tasteContext, actionContext, language } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (!cellarContext || !cellarContext.bottles || cellarContext.bottles.length === 0) {
        return res.status(400).json({ error: 'Cellar context is required' });
      }

      // ── Credit pre-flight check (fast-fail when enforcement is enabled) ──
      // During dark launch enforcement is OFF for all users → always passes.
      // When Stage 3 begins (credit_enforcement_enabled = true), this gate
      // will block users with insufficient Sommelier Credits before we waste
      // an OpenAI request.
      const creditCheck = await checkCreditBalance(req.userId!, 'sommelier_chat_message');
      if (!creditCheck.allowed) {
        console.log(
          '[Sommelier]',
          JSON.stringify({
            phase: 'credit_block',
            user: req.userId?.slice(0, 8),
            reason: creditCheck.reason,
            balance: creditCheck.effectiveBalance,
            required: creditCheck.required,
          }),
        );
        return res.status(402).json({
          error: 'insufficient_credits',
          message: 'You have used all your Sommelier Credits for this period.',
          effectiveBalance: creditCheck.effectiveBalance,
          required: creditCheck.required,
        });
      }

      console.log(
        '[Sommelier]',
        JSON.stringify({
          phase: 'recommend_http',
          user: req.userId?.slice(0, 8),
          cellarEntries: cellarContext.bottles.length,
          msgLen: message.length,
          hasTasteContext: !!tasteContext,
          hasActionContext: !!actionContext,
        })
      );

      const userSupabase = createUserSupabase(req);

      const recommendation = await recommendCellar({
        openai,
        userId: req.userId!,
        supabase: userSupabase,
        message,
        history: history || [],
        cellarBottles: cellarContext.bottles,
        tasteContext: typeof tasteContext === 'string' ? tasteContext : undefined,
        actionContext:
          actionContext && typeof actionContext === 'object' ? actionContext : undefined,
        language: typeof language === 'string' ? language : undefined,
      });

      if (!recommendation) {
        console.error('[Sommelier]', JSON.stringify({ phase: 'recommend_http', error: 'empty_result' }));
        // Log failed usage — no credits charged
        void processAiCreditUsage({
          userId: req.userId!,
          actionType: 'sommelier_chat_message',
          requestStatus: 'failed',
          metadata: { phase: 'empty_result' },
        });
        return res.status(500).json({
          error: 'Failed to generate valid recommendation',
        });
      }

      const duration = Date.now() - startTime;
      const meta = (recommendation as { agentMeta?: { routedAction?: string; processingMode?: string; actionResult?: string; model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } } })
        .agentMeta;

      // ── Log successful usage (best-effort, non-blocking) ──
      void processAiCreditUsage({
        userId:        req.userId!,
        actionType:    'sommelier_chat_message',
        requestStatus: 'success',
        modelName:     meta?.model ?? null,
        inputTokens:   meta?.usage?.prompt_tokens ?? null,
        outputTokens:  meta?.usage?.completion_tokens ?? null,
        metadata: {
          processingMode: meta?.processingMode ?? null,
          routedAction:   meta?.routedAction ?? null,
          cellarEntries:  cellarContext.bottles.length,
          durationMs:     duration,
        },
      });

      console.log(
        '[Sommelier]',
        JSON.stringify({
          phase: 'recommend_http_done',
          user: req.userId?.slice(0, 8),
          ms: duration,
          responseType: (recommendation as { type?: string })?.type ?? 'message',
          processingMode: meta?.processingMode ?? null,
          routedAction: meta?.routedAction ?? null,
          actionResult: meta?.actionResult ?? null,
        })
      );

      return res.json(recommendation);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        '[Sommelier]',
        JSON.stringify({
          phase: 'recommend_http_error',
          ms: duration,
          err: error?.message?.slice(0, 120),
        })
      );
      // Log error usage — no credits charged
      void processAiCreditUsage({
        userId:        req.userId!,
        actionType:    'sommelier_chat_message',
        requestStatus: 'error',
        metadata:      { durationMs: duration, errMsg: error?.message?.slice(0, 120) },
      });
      return res.status(500).json({ 
        error: 'Failed to generate recommendation. Please try again.' 
      });
    }
  }
);

/**
 * POST /api/agent/feedback
 * Body: { feedback: string, recommendationEventId?: string, bottleId?: string }
 */
agentRouter.post(
  '/feedback',
  authenticateProduction,
  checkFeatureFlag,
  rateLimit,
  async (req: AuthRequest, res) => {
    try {
      const { recommendationEventId, bottleId, feedback } = req.body;
      if (!feedback || typeof feedback !== 'string') {
        return res.status(400).json({ error: 'feedback is required' });
      }

      const supabase = createUserSupabase(req);
      if (!supabase) {
        return res.status(500).json({ error: 'Server configuration error' });
      }

      await saveSommelierFeedback(req.userId!, {
        rawText: feedback,
        recommendationEventId: recommendationEventId ?? null,
        bottleId: bottleId ?? null,
        supabase,
        applyToMemory: true,
      });

      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Failed to save feedback' });
    }
  }
);

/**
 * POST /api/agent/outcome
 * Body: { eventId: string, outcome: RecommendationOutcome }
 */
agentRouter.post(
  '/outcome',
  authenticateProduction,
  checkFeatureFlag,
  rateLimit,
  async (req: AuthRequest, res) => {
    try {
      const { eventId, outcome } = req.body;
      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ error: 'eventId is required' });
      }

      const valid: RecommendationOutcome[] = [
        'pending',
        'accepted',
        'rejected',
        'opened',
        'feedback_positive',
        'feedback_negative',
        'feedback_neutral',
      ];
      if (!outcome || !valid.includes(outcome)) {
        return res.status(400).json({ error: 'invalid outcome' });
      }

      const supabase = createUserSupabase(req);
      if (!supabase) {
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const ok = await updateRecommendationOutcome(eventId, req.userId!, outcome, supabase);
      if (!ok) {
        return res.status(500).json({ error: 'Failed to update outcome' });
      }
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Failed to update outcome' });
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

      // Log transcription usage (0 credits — supporting feature, not charged separately).
      // The resulting text feeds into a chat message which is charged via /recommend.
      void processAiCreditUsage({
        userId:        req.userId!,
        actionType:    'voice_transcription',
        requestStatus: 'success',
        modelName:     'whisper-1',
        metadata:      { durationMs: duration, textLength: transcription.text.length },
      });

      return res.json({ text: transcription.text });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[Sommelier] Transcription error:', error.message, `| duration: ${duration}ms`);
      void processAiCreditUsage({
        userId:        req.userId!,
        actionType:    'voice_transcription',
        requestStatus: 'error',
        metadata:      { durationMs: duration, errMsg: error?.message?.slice(0, 120) },
      });
      return res.status(500).json({ 
        error: 'Failed to transcribe audio' 
      });
    }
  }
);
