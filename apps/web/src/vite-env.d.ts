/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Optional: landing page demo — YouTube/Vimeo URL or /path/to.mp4 under public/ */
  readonly VITE_LANDING_DEMO_VIDEO_URL?: string
  /** Optional: poster image for native video element (path or URL) */
  readonly VITE_LANDING_DEMO_VIDEO_POSTER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

