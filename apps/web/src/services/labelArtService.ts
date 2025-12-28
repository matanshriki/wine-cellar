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

// App-level feature flag check (master switch)
export const isLabelArtFeatureAvailable = (): boolean => {
  return import.meta.env.VITE_FEATURE_GENERATED_LABEL_ART === 'true';
};

/**
 * Check if current user has AI label art enabled
 * Two-level check: App-level flag AND user-level flag
 */
export const isLabelArtEnabledForUser = async (): Promise<boolean> => {
  // First check: Is feature available at app level?
  if (!isLabelArtFeatureAvailable()) {
    return false;
  }

  // Second check: Is feature enabled for this specific user?
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return false;
  }

  // Get user's profile to check their ai_label_art_enabled flag
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('ai_label_art_enabled')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    console.error('Error fetching user profile:', error);
    return false;
  }

  return profile.ai_label_art_enabled === true;
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
  if (!isLabelArtEnabled()) {
    throw new Error('Label art generation is not enabled');
  }

  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Build safe prompt
  const prompt = buildSafeLabelPrompt(bottle.wine, style);
  const promptHash = await hashPrompt(prompt);

  // Call backend Edge Function (Supabase Function)
  const { data, error } = await supabase.functions.invoke('generate-label-art', {
    body: {
      wineId: bottle.wine.id,
      bottleId: bottle.id,
      prompt,
      promptHash,
      style,
    },
  });

  if (error) {
    console.error('Error generating label art:', error);
    throw new Error(error.message || 'Failed to generate label art');
  }

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
  // Priority 1: User-provided image
  if (wine.image_url) {
    return {
      imageUrl: wine.image_url,
      isGenerated: false,
      isPlaceholder: false,
    };
  }

  // Priority 2: AI-generated image
  if ((wine as any).generated_image_path) {
    // Convert storage path to public URL
    const { data } = supabase.storage
      .from('generated-labels')
      .getPublicUrl((wine as any).generated_image_path);
    
    return {
      imageUrl: data.publicUrl,
      isGenerated: true,
      isPlaceholder: false,
    };
  }

  // Priority 3: Placeholder
  return {
    imageUrl: null,
    isGenerated: false,
    isPlaceholder: true,
  };
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

