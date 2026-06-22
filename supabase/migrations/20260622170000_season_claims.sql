-- Season payout entitlements + on-chain claim tracking.

create table if not exists public.season_payouts (
  wallet_pubkey text not null references public.operators (wallet_pubkey) on delete cascade,
  season_id integer not null check (season_id >= 1),
  rank integer not null check (rank >= 1 and rank <= 10),
  amount_yami numeric not null check (amount_yami > 0),
  season_yen numeric not null default 0,
  destination_pubkey text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'claimed', 'failed')),
  tx_signature text,
  claim_error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  primary key (wallet_pubkey, season_id)
);

create index if not exists season_payouts_status_idx
  on public.season_payouts (status, season_id desc);

comment on table public.season_payouts is
  'Leaderboard season rewards — claimable via treasury SPL transfer.';

-- Mirror src/store/seasonConfig.ts (500_000 pool, top 10 shares).
create or replace function public.season_payout_yami_for_rank(p_rank integer)
returns numeric
language sql
immutable
as $$
  select case greatest(1, least(coalesce(p_rank, 0), 10))
    when 1 then 150000
    when 2 then 100000
    when 3 then 75000
    when 4 then 50000
    when 5 then 40000
    when 6 then 30000
    when 7 then 20000
    when 8 then 15000
    when 9 then 10000
    when 10 then 10000
    else 0
  end;
$$;

create or replace function public.effective_operator_payout(p_wallet text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(o.payout_pubkey), ''),
    o.wallet_pubkey
  )
  from public.operators o
  where o.wallet_pubkey = trim(p_wallet);
$$;

create or replace function public.register_season_payout(p_wallet text, p_season_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet text := trim(p_wallet);
  v_rank bigint;
  v_yen numeric;
  v_phase smallint;
  v_amount numeric;
  v_destination text;
  v_existing public.season_payouts%rowtype;
begin
  if v_wallet is null or length(v_wallet) < 32 then
    return jsonb_build_object('success', false, 'code', 'INVALID', 'message', 'Invalid wallet.');
  end if;

  if p_season_id is null or p_season_id < 1 then
    return jsonb_build_object('success', false, 'code', 'INVALID', 'message', 'Invalid season.');
  end if;

  if not exists (select 1 from public.operators where wallet_pubkey = v_wallet) then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_REGISTERED',
      'message', 'Operator not registered.'
    );
  end if;

  select rank, season_yen, phase
    into v_rank, v_yen, v_phase
    from public.get_leaderboard(p_season_id, 10) lb
   where lb.wallet_pubkey = v_wallet
   limit 1;

  if v_rank is null then
    return jsonb_build_object(
      'success', true,
      'registered', false,
      'message', 'Not in top 10 payout zone for this cycle.'
    );
  end if;

  v_amount := public.season_payout_yami_for_rank(v_rank::integer);
  if v_amount <= 0 then
    return jsonb_build_object('success', false, 'code', 'INVALID', 'message', 'Invalid payout amount.');
  end if;

  v_destination := public.effective_operator_payout(v_wallet);
  if v_destination is null then
    return jsonb_build_object('success', false, 'code', 'INVALID', 'message', 'Missing payout destination.');
  end if;

  select * into v_existing
    from public.season_payouts
   where wallet_pubkey = v_wallet and season_id = p_season_id;

  if found then
    return jsonb_build_object(
      'success', true,
      'registered', true,
      'season_id', p_season_id,
      'rank', v_existing.rank,
      'amount_yami', v_existing.amount_yami,
      'status', v_existing.status,
      'tx_signature', v_existing.tx_signature,
      'destination_pubkey', v_existing.destination_pubkey
    );
  end if;

  insert into public.season_payouts (
    wallet_pubkey,
    season_id,
    rank,
    amount_yami,
    season_yen,
    destination_pubkey,
    status
  ) values (
    v_wallet,
    p_season_id,
    v_rank::integer,
    v_amount,
    coalesce(v_yen, 0),
    v_destination,
    'pending'
  );

  return jsonb_build_object(
    'success', true,
    'registered', true,
    'season_id', p_season_id,
    'rank', v_rank,
    'amount_yami', v_amount,
    'status', 'pending',
    'destination_pubkey', v_destination
  );
end;
$$;

create or replace function public.get_claimable_payouts(p_wallet text)
returns table (
  season_id integer,
  rank integer,
  amount_yami numeric,
  season_yen numeric,
  destination_pubkey text,
  status text,
  tx_signature text,
  claim_error text,
  claimed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sp.season_id,
    sp.rank,
    sp.amount_yami,
    sp.season_yen,
    sp.destination_pubkey,
    sp.status,
    sp.tx_signature,
    sp.claim_error,
    sp.claimed_at
  from public.season_payouts sp
  where sp.wallet_pubkey = trim(p_wallet)
  order by sp.season_id desc;
$$;

create or replace function public.begin_season_claim(p_wallet text, p_season_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.season_payouts%rowtype;
begin
  if p_wallet is null or length(trim(p_wallet)) < 32 then
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
      and cs.sync_clamp_count >= 10
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

create or replace function public.finish_season_claim(
  p_wallet text,
  p_season_id integer,
  p_tx_signature text,
  p_success boolean,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.season_payouts%rowtype;
begin
  select * into v_row
    from public.season_payouts
   where wallet_pubkey = trim(p_wallet)
     and season_id = p_season_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Payout row not found.');
  end if;

  if p_success then
    update public.season_payouts
       set status = 'claimed',
           tx_signature = nullif(trim(coalesce(p_tx_signature, '')), ''),
           claim_error = null,
           claimed_at = now()
     where wallet_pubkey = v_row.wallet_pubkey
       and season_id = v_row.season_id;

    return jsonb_build_object(
      'success', true,
      'status', 'claimed',
      'tx_signature', nullif(trim(coalesce(p_tx_signature, '')), '')
    );
  end if;

  update public.season_payouts
     set status = 'failed',
         claim_error = left(coalesce(p_error, 'Claim failed.'), 500)
   where wallet_pubkey = v_row.wallet_pubkey
     and season_id = v_row.season_id;

  return jsonb_build_object(
    'success', false,
    'status', 'failed',
    'message', coalesce(p_error, 'Claim failed.')
  );
end;
$$;

create or replace function public.release_season_claim(p_wallet text, p_season_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.season_payouts
     set status = case when status = 'processing' then 'pending' else status end
   where wallet_pubkey = trim(p_wallet)
     and season_id = p_season_id
     and status = 'processing';

  return jsonb_build_object('success', true);
end;
$$;

-- Only service role / edge function should call begin/finish/release (no anon grant).
grant execute on function public.register_season_payout(text, integer) to anon, authenticated;
grant execute on function public.get_claimable_payouts(text) to anon, authenticated;
grant execute on function public.season_payout_yami_for_rank(integer) to anon, authenticated;

grant execute on function public.begin_season_claim(text, integer) to service_role;
grant execute on function public.finish_season_claim(text, integer, text, boolean, text) to service_role;
grant execute on function public.release_season_claim(text, integer) to service_role;
