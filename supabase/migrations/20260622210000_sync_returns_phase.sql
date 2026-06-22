-- Return authoritative phase from sync so client can clamp spoofed progression.

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
  v_sync_slack constant numeric := 1.72;
  v_first_sync_hours constant numeric := 8.0;
  v_first_sync_slack constant numeric := 1.6;
  v_first_sync_phase_cap constant smallint := 5;
begin
  if v_wallet is null or not public.is_valid_solana_address(v_wallet) then
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
    v_effective_phase := least(v_phase, v_first_sync_phase_cap);
    v_rate := public.max_yen_per_minute(v_effective_phase);
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
      last_clamped_at,
      last_clamp_reason
    )
    values (
      v_wallet,
      p_season_id,
      v_next,
      v_effective_phase,
      v_now,
      v_now,
      0,
      null,
      v_clamp_reason
    );

    return jsonb_build_object(
      'success', true,
      'yen_earned', v_next,
      'phase', v_effective_phase,
      'clamped', v_clamped,
      'clamp_reason', v_clamp_reason,
      'server_rate_cap', v_rate
    );
  end if;

  v_effective_phase := least(
    greatest(v_row.phase, v_phase),
    v_row.phase + 2
  );

  v_rate := public.max_yen_per_minute(v_effective_phase);
  v_elapsed_minutes := greatest(0, extract(epoch from (v_now - v_row.last_synced_at)) / 60.0);

  v_max_gain := v_elapsed_minutes * v_rate * v_sync_slack;

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
    sync_clamp_count = sync_clamp_count + case
      when v_clamped and v_clamp_reason = 'rate_cap' then 1
      else 0
    end,
    last_clamped_at = case
      when v_clamped and v_clamp_reason = 'rate_cap' then v_now
      else last_clamped_at
    end,
    last_clamp_reason = coalesce(v_clamp_reason, last_clamp_reason)
  where wallet_pubkey = v_wallet and season_id = p_season_id;

  return jsonb_build_object(
    'success', true,
    'yen_earned', v_next,
    'phase', v_effective_phase,
    'clamped', v_clamped,
    'clamp_reason', v_clamp_reason,
    'server_rate_cap', v_rate
  );
end;
$$;
