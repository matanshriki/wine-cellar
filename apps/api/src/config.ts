import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local first (for local overrides), then .env
dotenv.config({ path: join(__dirname, '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Google OAuth (optional)
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  
  // Supabase (for Agent authentication)
  // Try both VITE_ prefixed and non-prefixed versions
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  // Service role key — used for server-side credit deduction (bypasses RLS).
  // Must NEVER be sent to the browser or logged.
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // URLs
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  webUrl: process.env.WEB_URL || 'http://localhost:5173',

  // Paddle Billing
  paddleApiKey:       process.env.PADDLE_API_KEY || '',
  paddleWebhookSecret: process.env.PADDLE_WEBHOOK_SECRET || '',
  paddleEnvironment:  (process.env.PADDLE_ENVIRONMENT || 'production') as 'sandbox' | 'production',

  // Paddle Price IDs (set on the billing server only — never sent to the browser)
  paddlePricePremiumMonthly:  process.env.PADDLE_PRICE_PREMIUM_MONTHLY  || '',
  paddlePriceCollectorMonthly: process.env.PADDLE_PRICE_COLLECTOR_MONTHLY || '',
  paddlePriceTopup50:         process.env.PADDLE_PRICE_TOPUP_50          || '',
  paddlePriceTopup150:        process.env.PADDLE_PRICE_TOPUP_150         || '',
};

// Log configuration on startup (without sensitive data)
console.log('[Config] Environment:', config.nodeEnv);
console.log('[Config] Port:', config.port);
console.log('[Config] OpenAI API Key:', config.openaiApiKey ? 'SET ✓' : 'NOT SET ✗');
console.log('[Config] Supabase URL:', config.supabaseUrl ? 'SET ✓' : 'NOT SET ✗');
console.log('[Config] Supabase Anon Key:', config.supabaseAnonKey ? 'SET ✓' : 'NOT SET ✗');
console.log('[Config] Supabase Service Role Key:', config.supabaseServiceRoleKey ? 'SET ✓' : 'NOT SET (credit deduction will be best-effort) ✗');
console.log('[Config] Web URL:', config.webUrl);
console.log('[Config] Paddle API Key:', config.paddleApiKey ? 'SET ✓' : 'NOT SET ✗');
console.log('[Config] Paddle Webhook Secret:', config.paddleWebhookSecret ? 'SET ✓' : 'NOT SET ✗');
console.log('[Config] Paddle Environment:', config.paddleEnvironment);
console.log('[Config] Paddle Price IDs:', [
  config.paddlePricePremiumMonthly,
  config.paddlePriceCollectorMonthly,
  config.paddlePriceTopup50,
  config.paddlePriceTopup150,
].every(Boolean) ? 'ALL SET ✓' : 'SOME MISSING ✗');

