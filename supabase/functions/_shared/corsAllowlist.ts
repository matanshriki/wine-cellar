/**
 * CORS allowlist for browser-facing edge functions.
 */

const ALLOWED_ORIGINS = new Set([
  'https://sommi-ai.com',
  'https://www.sommi-ai.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
]);

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://sommi-ai.com';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
