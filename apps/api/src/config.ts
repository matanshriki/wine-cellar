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
  
  // URLs
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  webUrl: process.env.WEB_URL || 'http://localhost:5173',
};

// Log configuration on startup (without sensitive data)
console.log('[Config] Environment:', config.nodeEnv);
console.log('[Config] Port:', config.port);
console.log('[Config] OpenAI API Key:', config.openaiApiKey ? 'SET ✓' : 'NOT SET ✗');
console.log('[Config] Supabase URL:', config.supabaseUrl ? 'SET ✓' : 'NOT SET ✗');
console.log('[Config] Supabase Anon Key:', config.supabaseAnonKey ? 'SET ✓' : 'NOT SET ✗');
console.log('[Config] Web URL:', config.webUrl);

