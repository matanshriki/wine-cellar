/**
 * Profile Sommi memory management (deterministic, zero credits).
 *
 * POST /api/profile/sommi-memory
 *   Authenticated allowlisted mutations against taste_profile.explicit
 *   via apply_taste_profile_memory_action. Never calls OpenAI /recommend.
 */

import { Router, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { type AuthRequest, authenticateSupabase } from '../middleware/auth.js';
import { parseProfileMemoryOperationId } from '../services/cellarAgent/profileMemoryOperation.js';
import {
  applyProfileSommiMemoryAction,
  parseProfileMemoryAction,
} from '../services/cellarAgent/profileSommiMemory.js';

export const profileRouter = Router();

function createUserSupabase(req: AuthRequest) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !config.supabaseUrl || !config.supabaseAnonKey) return null;
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

function statusForReason(reason: string): number {
  switch (reason) {
    case 'writes_off':
      return 503;
    case 'invalid_action':
    case 'invalid_operation_id':
      return 400;
    case 'not_found':
      return 404;
    case 'conflict':
    case 'idempotency_conflict':
      return 409;
    case 'load_error':
      return 500;
    default:
      return 500;
  }
}

profileRouter.post(
  '/sommi-memory',
  authenticateSupabase,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const operationId = parseProfileMemoryOperationId(req.body);
    if (!operationId) {
      return res.status(400).json({
        error: 'invalid_operation_id',
        message: 'operationId is required and must be a UUID.',
      });
    }

    const action = parseProfileMemoryAction(req.body);
    if (!action) {
      return res.status(400).json({
        error: 'invalid_action',
        message: 'Unsupported or malformed sommi-memory action.',
      });
    }

    const language =
      req.body?.locale === 'he' || req.body?.language === 'he' ? 'he' : 'en';

    const supabase = createUserSupabase(req);
    if (!supabase) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const result = await applyProfileSommiMemoryAction({
      userId,
      supabase,
      action,
      operationId,
      language,
    });

    if (!result.ok) {
      return res.status(statusForReason(result.reason)).json({
        error: result.reason,
        message: result.message,
        memory: result.memory ?? null,
      });
    }

    return res.json({
      ok: true,
      reason: result.reason,
      memory: result.memory,
    });
  }
);
