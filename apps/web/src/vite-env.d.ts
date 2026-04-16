/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Meta (Facebook) Pixel ID — browser; omit in local dev to disable Pixel */
  readonly VITE_META_PIXEL_ID?: string
  /** Sommi API base URL (for Meta CAPI relay). Example: http://localhost:3001 */
  readonly VITE_API_URL?: string
  /** Optional: landing page demo — YouTube/Vimeo URL or /path/to.mp4 under public/ */
  readonly VITE_LANDING_DEMO_VIDEO_URL?: string
  /** Optional: poster image for native video element (path or URL) */
  readonly VITE_LANDING_DEMO_VIDEO_POSTER?: string
  /**
   * Dev only: `true` or `1` replays Sommi FAB first-visit UI (mobile chip / desktop
   * gold tooltip) on every refresh; does not write intro-seen to localStorage.
   */
  readonly VITE_SOMMELIER_FAB_INTRO_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

