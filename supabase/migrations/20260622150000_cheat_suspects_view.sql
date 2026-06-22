-- Admin view: operators flagged by server-side score clamping (anti-cheat audit)
-- Supabase → Table Editor or SQL Editor: select * from public.cheat_suspects;

create or replace view public.cheat_suspects as
select
  o.handle,
  cs.wallet_pubkey,
  cs.season_id,
  cs.yen_earned,
  cs.phase,
  cs.sync_clamp_count,
  cs.last_clamped_at,
  cs.last_synced_at,
  public.max_yen_per_minute(cs.phase) as max_yen_per_minute,
  round(public.max_yen_per_minute(cs.phase) * 60 * 24, 0) as max_yen_per_day_estimate,
  case
    when cs.sync_clamp_count >= 10 then 'high'
    when cs.sync_clamp_count >= 3 then 'medium'
    when cs.sync_clamp_count > 0 then 'low'
    else 'clean'
  end as suspicion_level,
  case
    when cs.last_clamped_at > now() - interval '24 hours' then true
    else false
  end as clamped_recently
from public.cycle_scores cs
inner join public.operators o on o.wallet_pubkey = cs.wallet_pubkey
where cs.sync_clamp_count > 0;

comment on view public.cheat_suspects is
  'Operators with sync_clamp_count > 0 — server rejected inflated season scores.';

grant select on public.cheat_suspects to anon, authenticated;

-- Read-only RPC for dashboard / scripts (returns top suspects)
create or replace function public.get_cheat_suspects(p_limit integer default 25)
returns table (
  handle text,
  wallet_pubkey text,
  season_id integer,
  yen_earned numeric,
  phase smallint,
  sync_clamp_count integer,
  last_clamped_at timestamptz,
  suspicion_level text,
  clamped_recently boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    handle,
    wallet_pubkey,
    season_id,
    yen_earned,
    phase,
    sync_clamp_count,
    last_clamped_at,
    suspicion_level,
    clamped_recently
  from public.cheat_suspects
  order by sync_clamp_count desc, last_clamped_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

grant execute on function public.get_cheat_suspects(integer) to anon, authenticated;
