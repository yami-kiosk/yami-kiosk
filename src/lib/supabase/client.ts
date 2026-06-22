import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PLACEHOLDER_PATTERNS = [
  'YOUR_PROJECT_REF',
  'your_anon_key_here',
  'your-project-ref',
  'changeme',
]

function readEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const raw = import.meta.env[name]
  return typeof raw === 'string' ? raw.trim() : ''
}

function normalizeSupabaseUrl(url: string): string {
  return url
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '')
}

function isPlaceholderValue(value: string): boolean {
  const upper = value.toUpperCase()
  return PLACEHOLDER_PATTERNS.some((pattern) =>
    upper.includes(pattern.toUpperCase()),
  )
}

function resolveSupabaseConfig(): { url: string; key: string } | null {
  const url = normalizeSupabaseUrl(readEnv('VITE_SUPABASE_URL'))
  const key = readEnv('VITE_SUPABASE_ANON_KEY')

  if (!url || !key) return null
  if (isPlaceholderValue(url) || isPlaceholderValue(key)) return null
  if (!/^https?:\/\//i.test(url)) return null
  if (key.length < 20) return null

  return { url, key }
}

const config = resolveSupabaseConfig()

let client: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return config !== null
}

export function getSupabaseProjectRef(): string | null {
  if (!config) return null
  const match = config.url.match(/https:\/\/([^.]+)\.supabase\.co/i)
  return match?.[1] ?? null
}

export function getSupabaseConfigHint(): string | null {
  const url = readEnv('VITE_SUPABASE_URL')
  const key = readEnv('VITE_SUPABASE_ANON_KEY')

  if (!url || !key) {
    return 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart npm run dev.'
  }
  if (isPlaceholderValue(url) || isPlaceholderValue(key)) {
    return 'Replace placeholder values in .env.local with your Supabase project URL + anon key, then restart npm run dev.'
  }
  if (!/^https?:\/\//i.test(normalizeSupabaseUrl(url))) {
    return 'VITE_SUPABASE_URL must start with https:// (no /rest/v1/ path).'
  }
  return null
}

export function getSupabase(): SupabaseClient | null {
  if (!config) return null
  if (!client) {
    client = createClient(config.url, config.key)
  }
  return client
}
