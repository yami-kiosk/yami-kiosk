-- Relax anti-cheat for legitimate fast clicking (player feedback)

create or replace function public.max_active_yen_per_minute(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select 480.0
    * ((public.phase_active_base(p_phase) + 20.0) / 60.0)
    * 1.234;
$$;

create or replace function public.max_raid_burst_yen(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select public.phase_passive_base(p_phase) * 4.5 * 2.5;
$$;

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
  v_sync_slack constant numeric := 2.2;
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
    last_clamp_reason = coalesce(v_clamp_reason, last_clamp_reason)
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

-- Claim block removed from sync_clamp_count (counter no longer incremented)
create or replace function public.begin_season_claim(p_wallet text, p_season_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.season_payouts%rowtype;
begin
  if p_wallet is null or not public.is_valid_solana_address(trim(p_wallet)) then
    return jsonb_build_object('success', false, 'code', 'INVALID', 'message', 'Invalid wallet.');
  end if;

  select * into v_row
  from public.season_payouts
  where wallet_pubkey = trim(p_wallet)
    and season_id = p_season_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'No payout entitlement for this cycle.'
    );
  end if;

  if v_row.status = 'claimed' then
    return jsonb_build_object(
      'success', false,
      'code', 'ALREADY_CLAIMED',
      'message', 'Reward already claimed.',
      'tx_signature', v_row.tx_signature
    );
  end if;

  if v_row.status = 'processing' then
    return jsonb_build_object(
      'success', false,
      'code', 'IN_PROGRESS',
      'message', 'Claim already in progress.'
    );
  end if;

  update public.season_payouts
     set status = 'processing',
         claim_error = null
   where wallet_pubkey = v_row.wallet_pubkey
     and season_id = v_row.season_id;

  return jsonb_build_object(
    'success', true,
    'season_id', v_row.season_id,
    'rank', v_row.rank,
    'amount_yami', v_row.amount_yami,
    'destination_pubkey', v_row.destination_pubkey
  );
end;
$$;

-- Reset false-positive clamp counts from earlier strict caps
update public.cycle_scores
set sync_clamp_count = 0,
    last_clamped_at = null,
    last_clamp_reason = null
where sync_clamp_count > 0;
