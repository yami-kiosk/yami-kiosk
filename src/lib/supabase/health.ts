import { getSupabase, getSupabaseConfigHint, isSupabaseConfigured } from './client'

export type SupabaseNetworkStatus =
  | 'unconfigured'
  | 'checking'
  | 'online'
  | 'offline'

export interface SupabaseHealthResult {
  status: SupabaseNetworkStatus
  message: string | null
}

export function getSupabaseConfigStatus(): SupabaseHealthResult {
  if (!isSupabaseConfigured()) {
    return {
      status: 'unconfigured',
      message:
        getSupabaseConfigHint() ??
        'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local',
    }
  }
  return { status: 'checking', message: null }
}

export async function pingSupabase(): Promise<SupabaseHealthResult> {
  const base = getSupabaseConfigStatus()
  if (base.status === 'unconfigured') return base

  const supabase = getSupabase()
  if (!supabase) {
    return {
      status: 'offline',
      message: 'Supabase client failed to initialize.',
    }
  }

  try {
    const { error } = await supabase.rpc('get_leaderboard', {
      p_season_id: 1,
      p_limit: 1,
    })

    if (error) {
      const hint = error.message.includes('does not exist')
        ? 'Run supabase/migrations SQL in your project (see .env.example).'
        : error.message
      return { status: 'offline', message: hint }
    }

    return { status: 'online', message: null }
  } catch (err) {
    return {
      status: 'offline',
      message: err instanceof Error ? err.message : 'Network error',
    }
  }
}
