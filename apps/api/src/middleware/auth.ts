import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/utils.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export interface AuthRequest extends Request {
  userId?: string;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = payload.userId;
  next();
}

/**
 * Authenticate with Supabase JWT token
 * Used for endpoints that need to interact with Supabase (e.g., events, profiles)
 */
export async function authenticateSupabase(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.error('[Auth] Supabase not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('[Auth] Supabase auth error:', error?.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.userId = user.id;
    next();
  } catch (error: any) {
    console.error('[Auth] Supabase auth exception:', error.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

