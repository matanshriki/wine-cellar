/**
 * AI-Generated Label Art Service
 * 
 * LEGAL & SAFETY:
 * - Generates ORIGINAL label-style artwork only
 * - NO scraping or copying of real wine labels
 * - NO reproduction of trademarks, logos, or brand typography
 * - Uses only generic metadata as inspiration
 * - Sanitizes all inputs to prevent trademark infringement
 */

import { supabase } from '../lib/supabase';
import type { BottleWithWineInfo } from './bottleService';
import { getWineDisplayImageSync } from '../hooks/useWineDisplayImage';

// App-level feature flag check (master switch)
export const isLabelArtFeatureAvailable = (): boolean => {
  const enabled = import.meta.env.VITE_FEATURE_GENERATED_LABEL_ART === 'true';
  console.log('[AI Label Art] Feature flag check:', {
    envVar: import.meta.env.VITE_FEATURE_GENERATED_LABEL_ART,
    enabled,
  });
  return enabled;
};

/**
 * Check if current user has AI label art enabled
 * Two-level check: App-level flag AND user-level flag
 */
export const isLabelArtEnabledForUser = async (): Promise<boolean> => {
  // First check: Is feature available at app level?
  const globalEnabled = isLabelArtFeatureAvailable();
  console.log('[AI Label Art] Global flag (VITE_FEATURE_GENERATED_LABEL_ART):', globalEnabled);
  
  if (!globalEnabled) {
    console.log('[AI Label Art] Feature disabled globally - button will not appear');
    return false;
  }

  // Second check: Is feature enabled for this specific user?
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.log('[AI Label Art] No user authenticated - button will not appear');
    return false;
  }

  console.log('[AI Label Art] Checking user flag for user:', user.email);

  // Get user's profile to check their ai_label_art_enabled flag
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('ai_label_art_enabled')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[AI Label Art] Error fetching user profile:', error);
    return false;
  }

  if (!profile) {
    console.error('[AI Label Art] No profile found for user');
    return false;
  }

  const userEnabled = profile.ai_label_art_enabled === true;
  console.log('[AI Label Art] User flag (ai_label_art_enabled):', profile.ai_label_art_enabled, '→', userEnabled ? 'ENABLED ✅' : 'DISABLED ❌');
  
  if (userEnabled) {
    console.log('[AI Label Art] ✅ Button WILL appear (both flags enabled)');
  } else {
    console.log('[AI Label Art] ❌ Button will NOT appear - user flag is disabled');
    console.log('[AI Label Art] Run this SQL to enable:', `UPDATE public.profiles SET ai_label_art_enabled = true WHERE email = '${user.email}';`);
  }

  return userEnabled;
};

/**
 * Legacy function name for backwards compatibility
 * @deprecated Use isLabelArtEnabledForUser() instead
 */
export const isLabelArtEnabled = isLabelArtFeatureAvailable;

export const isOpenAIConfigured = (): boolean => {
  // Check if OpenAI is configured (backend will validate actual key)
  return isLabelArtFeatureAvailable();
};

export type LabelArtStyle = 'classic' | 'modern';

interface GenerateLabelArtRequest {
  bottleId: string;
  wineId: string;
  style: LabelArtStyle;
}

interface GenerateLabelArtResponse {
  success: boolean;
  imagePath?: string;
  imageUrl?: string;
  cached?: boolean;
  error?: string;
}

/**
 * Sanitize text to remove trademarked terms and prevent brand infringement
 * This is a safety layer - the backend also sanitizes
 */
function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  // Remove common trademark indicators
  const cleaned = text
    .replace(/®/g, '')
    .replace(/™/g, '')
    .replace(/©/g, '')
    .trim();
  
  // Remove "Vivino" explicitly
  const noVivino = cleaned.replace(/vivino/gi, '');
  
  // Truncate to prevent overly long prompts
  return noVivino.slice(0, 100);
}

/**
 * Build safe prompt for AI label generation
 * CRITICAL: This function ensures we never reproduce real labels
 */
export function buildSafeLabelPrompt(
  wine: BottleWithWineInfo['wine'],
  style: LabelArtStyle
): string {
  // Sanitize all inputs
  const wineNameSafe = sanitizeText(wine.wine_name) || 'Premium Wine';
  const vintageOrNV = wine.vintage ? String(wine.vintage) : 'N.V.';
  const regionSafe = sanitizeText(wine.region);
  const styleSafe = wine.color ? wine.color.charAt(0).toUpperCase() + wine.color.slice(1) : '';
  
  // Style-specific prompt prefixes
  const stylePrefix = style === 'classic'
    ? 'Create an ORIGINAL, premium wine-label-style image with a CLASSIC, TRADITIONAL aesthetic.'
    : 'Create an ORIGINAL, premium wine-label-style image with a MODERN, MINIMAL aesthetic.';
  
  // Build safe prompt
  const prompt = `${stylePrefix}

Square composition (1:1 ratio), centered layout, clean and refined.
Use abstract shapes, subtle emboss/foil-like accents, and elegant generic typography.
Neutral background (off-white, warm cream, or soft textured paper).

Include ONLY the following text, laid out tastefully:
- Wine: "${wineNameSafe}"
- Vintage: "${vintageOrNV}"
${regionSafe ? `- Region: "${regionSafe}"` : ''}
${styleSafe ? `- Style: "${styleSafe}"` : ''}

CRITICAL RULES:
- Do NOT include any logos, trademarks, crests, seals, medals, or recognizable label layouts.
- Do NOT reference Vivino or any external source.
- Do NOT imitate any specific producer, label, or typography associated with a known brand.
- Keep it refined, legible, and minimal, with generous whitespace.
- The result should look like a high-end generic wine label concept, not a photo of a real bottle.
${style === 'modern' ? '- Use modern, geometric shapes and clean sans-serif typography.' : '- Use classic, elegant shapes and serif typography.'}`;

  return prompt;
}

/**
 * Generate hash of prompt for idempotency
 */
export async function hashPrompt(prompt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Call backend API to generate label art
 * Backend handles: OpenAI call, storage upload, database update
 */
export async function generateLabelArt(
  bottle: BottleWithWineInfo,
  style: LabelArtStyle
): Promise<GenerateLabelArtResponse> {
  // Check if feature is enabled for this user (async check)
  const enabled = await isLabelArtEnabledForUser();
  if (!enabled) {
    throw new Error('Label art generation is not enabled for your account');
  }

  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Build safe prompt
  const prompt = buildSafeLabelPrompt(bottle.wine, style);
  const promptHash = await hashPrompt(prompt);

  // Get current session to include auth header
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error('[AI Label Client] ❌ No active session');
    throw new Error('No active session. Please log in again.');
  }

  console.log('[AI Label Client] ✅ Session found, user:', session.user?.id);
  console.log('[AI Label Client] ✅ Token length:', session.access_token?.length);
  console.log('[AI Label Client] 📤 Sending request to Edge Function...');
  console.log('[AI Label Client] 📋 Body:', {
    wineId: bottle.wine.id,
    bottleId: bottle.id,
    promptHash: promptHash.substring(0, 8),
    style,
  });

  // Call backend Edge Function directly with fetch (Supabase client has issues with --no-verify-jwt)
  console.log('[AI Label Client] 🚀 Calling Edge Function directly with fetch...');
  
  const requestBody = {
    wineId: bottle.wine.id,
    bottleId: bottle.id,
    prompt,
    promptHash,
    style,
  };
  
  console.log('[AI Label Client] 📤 Request body:', {
    wineId: bottle.wine.id,
    bottleId: bottle.id,
    style,
    promptLength: prompt.length,
    promptHashPreview: promptHash.substring(0, 8),
  });
  
  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-label-art`;
  console.log('[AI Label Client] 🌐 Function URL:', functionUrl);
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  console.log('[AI Label Client] 📥 Response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AI Label Client] ❌ Error response:', errorText);
    throw new Error(`Edge Function returned ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  console.log('[AI Label Client] ✅ Response data:', data);

  return data as GenerateLabelArtResponse;
}

/**
 * Get display image for a wine
 * Priority: user-provided image_url > generated_image_path > placeholder
 */
export function getWineDisplayImage(wine: BottleWithWineInfo['wine']): {
  imageUrl: string | null;
  isGenerated: boolean;
  isPlaceholder: boolean;
} {
  return getWineDisplayImageSync(wine);
}

/**
 * Fallback: Generate deterministic placeholder SVG based on wine style
 * Used in development when OpenAI is not configured
 */
export function generateFallbackPlaceholderSVG(wine: BottleWithWineInfo['wine']): string {
  const colors = {
    red: '#8B2332',
    white: '#F5E6D3',
    rose: '#FFB6C1',
    sparkling: '#FFD700',
  };

  const bgColor = colors[wine.color as keyof typeof colors] || '#8B2332';
  const textColor = wine.color === 'white' ? '#333' : '#fff';

  const svg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="${bgColor}"/>
      <text x="100" y="90" text-anchor="middle" font-family="serif" font-size="16" fill="${textColor}" opacity="0.9">
        ${wine.wine_name.slice(0, 20)}
      </text>
      <text x="100" y="120" text-anchor="middle" font-family="serif" font-size="24" font-weight="bold" fill="${textColor}">
        ${wine.vintage || 'N.V.'}
      </text>
      <text x="100" y="145" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${textColor}" opacity="0.7">
        ${wine.region || ''}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

