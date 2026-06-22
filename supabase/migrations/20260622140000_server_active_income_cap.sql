-- Server-side anti-cheat: passive + human click income ceiling per phase
-- Mirrors client economy (gameConfig + max skills + doctrine/combo headroom)
-- Complements client injectGuard; protects leaderboard / season pool

-- Phase base passive $YEN/min (offlineRatePerMin)
create or replace function public.phase_passive_base(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select case greatest(1, least(6, coalesce(p_phase, 1)))
    when 1 then 3.5
    when 2 then 9.0
    when 3 then 28.0
    when 4 then 80.0
    when 5 then 280.0
    when 6 then 1100.0
    else 3.5
  end;
$$;

-- Phase base active $YEN/min (activeRatePerMin)
create or replace function public.phase_active_base(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select case greatest(1, least(6, coalesce(p_phase, 1)))
    when 1 then 14.0
    when 2 then 36.0
    when 3 then 110.0
    when 4 then 320.0
    when 5 then 1100.0
    when 6 then 4200.0
    else 14.0
  end;
$$;

-- Max passive: base + max skill/hijack (+20/min) × milestone/doctrine/overclock slack
create or replace function public.max_passive_yen_per_minute(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select (public.phase_passive_base(p_phase) + 20.0) * 1.134;
$$;

-- Max active: ~65 full-reward human clicks/min (matches client injectGuard window)
-- × (active + software 10) per click × combo + operator doctrine headroom
create or replace function public.max_active_yen_per_minute(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select 65.0
    * ((public.phase_active_base(p_phase) + 20.0) / 60.0)
    * 1.234;
$$;

-- One raid win burst allowance between syncs (~4.5 min passive + loot mult slack)
create or replace function public.max_raid_burst_yen(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select public.phase_passive_base(p_phase) * 4.5 * 1.3;
$$;

-- Total legitimate $YEN/min ceiling (passive tick + human inject spam)
create or replace function public.max_yen_per_minute(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select public.max_passive_yen_per_minute(p_phase)
       + public.max_active_yen_per_minute(p_phase);
$$;

-- Audit trail for clamped syncs
alter table public.cycle_scores
  add column if not exists sync_clamp_count integer not null default 0,
  add column if not exists last_clamped_at timestamptz;

create or replace function public.sync_cycle_score(
  p_wallet text,
  p_season_id integer,
  p_yen_earned numeric,
  p_phase smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet text := trim(p_wallet);
  v_row public.cycle_scores%rowtype;
  v_now timestamptz := now();
  v_elapsed_minutes numeric;
  v_rate numeric;
  v_max_gain numeric;
  v_cap numeric;
  v_phase smallint := greatest(1, least(6, coalesce(p_phase, 1)));
  v_effective_phase smallint;
  v_client numeric := greatest(0, coalesce(p_yen_earned, 0));
  v_next numeric;
  v_clamped boolean := false;
  v_clamp_reason text := null;
  -- sync slack: timing jitter + offline tick drift
  v_sync_slack constant numeric := 1.35;
  v_first_sync_hours constant numeric := 6.0;
  v_first_sync_slack constant numeric := 1.25;
begin
  if v_wallet is null or length(v_wallet) < 32 then
    return jsonb_build_object('success', false, 'message', 'Invalid wallet.');
  end if;

  if p_season_id is null or p_season_id < 1 then
    return jsonb_build_object('success', false, 'message', 'Invalid season.');
  end if;

  if not exists (select 1 from public.operators where wallet_pubkey = v_wallet) then
    return jsonb_build_object('success', false, 'message', 'Operator not registered.');
  end if;

  select * into v_row
  from public.cycle_scores
  where wallet_pubkey = v_wallet and season_id = p_season_id
  for update;

  if not found then
    v_rate := public.max_yen_per_minute(v_phase);
    v_cap := v_rate * 60.0 * v_first_sync_hours * v_first_sync_slack;
    v_next := least(v_client, v_cap);
    v_clamped := v_next < v_client;
    if v_clamped then
      v_clamp_reason := 'initial_cap';
    end if;

    insert into public.cycle_scores (
      wallet_pubkey,
      season_id,
      yen_earned,
      phase,
      last_synced_at,
      updated_at,
      sync_clamp_count,
      last_clamped_at
    )
    values (
      v_wallet,
      p_season_id,
      v_next,
      v_phase,
      v_now,
      v_now,
      case when v_clamped then 1 else 0 end,
      case when v_clamped then v_now else null end
    );

    return jsonb_build_object(
      'success', true,
      'yen_earned', v_next,
      'clamped', v_clamped,
      'clamp_reason', v_clamp_reason,
      'server_rate_cap', v_rate
    );
  end if;

  v_effective_phase := greatest(v_row.phase, v_phase);
  v_rate := public.max_yen_per_minute(v_effective_phase);
  v_elapsed_minutes := greatest(0, extract(epoch from (v_now - v_row.last_synced_at)) / 60.0);

  -- Steady income: passive + bounded human active clicks
  v_max_gain := v_elapsed_minutes * v_rate * v_sync_slack;

  -- Allow one raid-win burst if enough time passed since last sync (~raid cooldown)
  if v_elapsed_minutes >= 1.0 then
    v_max_gain := v_max_gain + public.max_raid_burst_yen(v_effective_phase);
  end if;

  v_next := greatest(v_row.yen_earned, least(v_client, v_row.yen_earned + v_max_gain));
  v_clamped := v_next < v_client;

  if v_clamped then
    v_clamp_reason := 'rate_cap';
  end if;

  update public.cycle_scores
  set
    yen_earned = v_next,
    phase = v_effective_phase,
    last_synced_at = v_now,
    updated_at = v_now,
    sync_clamp_count = sync_clamp_count + case when v_clamped then 1 else 0 end,
    last_clamped_at = case when v_clamped then v_now else last_clamped_at end
  where wallet_pubkey = v_wallet and season_id = p_season_id;

  return jsonb_build_object(
    'success', true,
    'yen_earned', v_next,
    'clamped', v_clamped,
    'clamp_reason', v_clamp_reason,
    'server_rate_cap', v_rate
  );
end;
$$;
