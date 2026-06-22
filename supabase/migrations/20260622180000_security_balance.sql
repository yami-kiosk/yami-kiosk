-- Security hardening + economy balance alignment (audit P0/P1)

-- Fix typo in payout address validator (migration 600)
create or replace function public.is_valid_solana_address(p_address text)
returns boolean
language sql
immutable
as $$
  select p_address is not null
    and length(trim(p_address)) between 32 and 44
    and trim(p_address) ~ '^[1-9A-HJ-NP-Za-km-z]+$';
$$;

-- season_payouts: deny direct REST access; route via RPC / edge functions
alter table public.season_payouts enable row level security;

-- Audit: store last clamp reason on cycle_scores
alter table public.cycle_scores
  add column if not exists last_clamp_reason text;

comment on column public.cycle_scores.last_clamp_reason is
  'rate_cap | initial_cap — only rate_cap increments sync_clamp_count (fairness).';

-- Align active click ceiling with client injectGuard (~12 cps sustained + combo slack)
create or replace function public.max_active_yen_per_minute(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select 200.0
    * ((public.phase_active_base(p_phase) + 20.0) / 60.0)
    * 1.234;
$$;

-- Larger raid / ghost burst allowance between syncs
create or replace function public.max_raid_burst_yen(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select public.phase_passive_base(p_phase) * 4.5 * 1.8;
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
  v_phase smallint := greatest(1, least(6, coalesce(p_phase, 1)));
  v_effective_phase smallint;
  v_client numeric := greatest(0, coalesce(p_yen_earned, 0));
  v_next numeric;
  v_clamped boolean := false;
  v_clamp_reason text := null;
  v_sync_slack constant numeric := 1.45;
  v_first_sync_hours constant numeric := 6.0;
  v_first_sync_slack constant numeric := 1.25;
  v_first_sync_phase_cap constant smallint := 3;
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

  -- At most +1 phase per sync (anti phase spoof)
  v_effective_phase := least(
    greatest(v_row.phase, v_phase),
    v_row.phase + 1
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
    sync_clamp_count = sync_clamp_count + case when v_clamped and v_clamp_reason = 'rate_cap' then 1 else 0 end,
    last_clamped_at = case when v_clamped and v_clamp_reason = 'rate_cap' then v_now else last_clamped_at end,
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

-- Stricter wallet validation on register
create or replace function public.register_operator(p_handle text, p_wallet text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handle text := upper(trim(p_handle));
  v_wallet text := trim(p_wallet);
  v_existing_handle text;
begin
  if not public.is_valid_solana_address(v_wallet) then
    return jsonb_build_object('success', false, 'code', 'INVALID', 'message', 'Invalid wallet.');
  end if;

  if v_handle is null or v_handle !~ '^[A-Z0-9_]{3,16}$' then
    return jsonb_build_object('success', false, 'code', 'INVALID', 'message', 'Handle must be 3–16 chars (A–Z, 0–9, _).');
  end if;

  if public.is_reserved_handle(v_handle) then
    return jsonb_build_object('success', false, 'code', 'RESERVED', 'message', 'Handle reserved by syndicate network.');
  end if;

  select handle into v_existing_handle from public.operators where wallet_pubkey = v_wallet;
  if found then
    if v_existing_handle = v_handle then
      return jsonb_build_object('success', true, 'handle', v_existing_handle);
    end if;
    return jsonb_build_object('success', false, 'code', 'WALLET_BOUND', 'message', 'Burner node already registered as ' || v_existing_handle || '.');
  end if;

  if exists (select 1 from public.operators where handle = v_handle) then
    return jsonb_build_object('success', false, 'code', 'TAKEN', 'message', 'Handle already claimed by another operator.');
  end if;

  insert into public.operators (wallet_pubkey, handle) values (v_wallet, v_handle);

  return jsonb_build_object('success', true, 'handle', v_handle);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'code', 'TAKEN', 'message', 'Handle already claimed by another operator.');
end;
$$;

-- Claim block: higher threshold + must be recent (fairness for grinders)
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

  if exists (
    select 1 from public.cheat_suspects cs
    where cs.wallet_pubkey = trim(p_wallet)
      and cs.sync_clamp_count >= 50
      and cs.clamped_recently = true
  ) then
    return jsonb_build_object(
      'success', false,
      'code', 'BLOCKED',
      'message', 'Payout blocked — syndicate audit flag on this node.'
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

-- Lock down write RPCs: service_role / edge functions only
revoke all on function public.register_operator(text, text) from public;
revoke all on function public.sync_cycle_score(text, integer, numeric, smallint) from public;
revoke all on function public.set_operator_payout(text, text) from public;
revoke all on function public.register_season_payout(text, integer) from public;

revoke all on function public.begin_season_claim(text, integer) from public;
revoke all on function public.finish_season_claim(text, integer, text, boolean, text) from public;
revoke all on function public.release_season_claim(text, integer) from public;

grant execute on function public.register_operator(text, text) to service_role;
grant execute on function public.sync_cycle_score(text, integer, numeric, smallint) to service_role;
grant execute on function public.set_operator_payout(text, text) to service_role;
grant execute on function public.register_season_payout(text, integer) to service_role;

grant execute on function public.begin_season_claim(text, integer) to service_role;
grant execute on function public.finish_season_claim(text, integer, text, boolean, text) to service_role;
grant execute on function public.release_season_claim(text, integer) to service_role;

-- Admin cheat audit: not public
revoke all on public.cheat_suspects from public;
revoke all on function public.get_cheat_suspects(integer) from public;

grant select on public.cheat_suspects to service_role;
grant execute on function public.get_cheat_suspects(integer) to service_role;

-- Read RPCs stay public
grant execute on function public.get_leaderboard(integer, integer) to anon, authenticated;
grant execute on function public.get_operator_handle(text) to anon, authenticated;
grant execute on function public.get_wallet_rank(text, integer) to anon, authenticated;
grant execute on function public.get_operator_payout(text) to anon, authenticated;
grant execute on function public.get_claimable_payouts(text) to anon, authenticated;
