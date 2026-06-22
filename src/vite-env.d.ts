/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_YAMI_MINT?: string
  readonly VITE_CLAIM_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
