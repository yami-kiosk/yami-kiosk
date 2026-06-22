-- YAMI KIOSK — operators, cycle leaderboard, RPC with rate caps

create table if not exists public.operators (
  wallet_pubkey text primary key,
  handle text not null unique,
  created_at timestamptz not null default now(),
  constraint operators_handle_format check (handle ~ '^[A-Z0-9_]{3,16}$')
);

create table if not exists public.cycle_scores (
  wallet_pubkey text not null references public.operators (wallet_pubkey) on delete cascade,
  season_id integer not null check (season_id > 0),
  yen_earned numeric not null default 0 check (yen_earned >= 0),
  phase smallint not null default 1 check (phase between 1 and 6),
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (wallet_pubkey, season_id)
);

create index if not exists cycle_scores_season_yen_idx
  on public.cycle_scores (season_id, yen_earned desc);

alter table public.operators enable row level security;
alter table public.cycle_scores enable row level security;

create policy "operators_public_read"
  on public.operators for select
  to anon, authenticated
  using (true);

create policy "cycle_scores_public_read"
  on public.cycle_scores for select
  to anon, authenticated
  using (true);

-- Max $YEN/min by phase (passive + active + skill headroom)
create or replace function public.max_yen_per_minute(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select case p_phase
    when 1 then 35
    when 2 then 120
    when 3 then 420
    when 4 then 1200
    when 5 then 4500
    when 6 then 16000
    else 35
  end;
$$;

create or replace function public.is_reserved_handle(p_handle text)
returns boolean
language sql
immutable
as $$
  select upper(p_handle) = any (array[
    'NEON_VIPER','GRID_RAT','VOID_RUNNER','KIOSK_GHOST','YAKUZA_NODE',
    'PINK_ICE','DATA_YAKUZA','ALLEY_KING','SYNTH_MONK','CORP_LEECH',
    'BLACKOUT_7','WIRE_FOX','JUNK_SAMURAI','HIVE_DRIFT','STATIC_GOD',
    'MEGACORP_RONIN','DIRTY_AEGIS','PULSE_DEALER',
    'YOU','YAMI','ADMIN','SYNDICATE','DEV','OPERATOR'
  ]);
$$;

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
  if v_wallet is null or length(v_wallet) < 32 then
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
  v_max_gain numeric;
  v_cap numeric;
  v_phase smallint := greatest(1, least(6, coalesce(p_phase, 1)));
  v_client numeric := greatest(0, coalesce(p_yen_earned, 0));
  v_next numeric;
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
    -- First sync: cap to ~6h of max rate at reported phase
    v_cap := public.max_yen_per_minute(v_phase) * 360 * 1.25;
    v_next := least(v_client, v_cap);

    insert into public.cycle_scores (wallet_pubkey, season_id, yen_earned, phase, last_synced_at, updated_at)
    values (v_wallet, p_season_id, v_next, v_phase, v_now, v_now);

    return jsonb_build_object('success', true, 'yen_earned', v_next, 'clamped', v_next < v_client);
  end if;

  v_elapsed_minutes := greatest(0, extract(epoch from (v_now - v_row.last_synced_at)) / 60.0);
  v_max_gain := v_elapsed_minutes * public.max_yen_per_minute(greatest(v_row.phase, v_phase)) * 1.35;
  v_next := greatest(v_row.yen_earned, least(v_client, v_row.yen_earned + v_max_gain));

  update public.cycle_scores
  set
    yen_earned = v_next,
    phase = greatest(v_row.phase, v_phase),
    last_synced_at = v_now,
    updated_at = v_now
  where wallet_pubkey = v_wallet and season_id = p_season_id;

  return jsonb_build_object(
    'success', true,
    'yen_earned', v_next,
    'clamped', v_next < v_client
  );
end;
$$;

create or replace function public.get_leaderboard(p_season_id integer, p_limit integer default 10)
returns table (
  rank bigint,
  wallet_pubkey text,
  handle text,
  season_yen numeric,
  phase smallint
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      cs.wallet_pubkey,
      o.handle,
      cs.yen_earned as season_yen,
      cs.phase,
      row_number() over (order by cs.yen_earned desc, cs.updated_at asc) as rank
    from public.cycle_scores cs
    inner join public.operators o on o.wallet_pubkey = cs.wallet_pubkey
    where cs.season_id = p_season_id
      and cs.phase >= 2
      and cs.yen_earned > 0
  )
  select rank, wallet_pubkey, handle, season_yen, phase
  from ranked
  where rank <= greatest(1, least(coalesce(p_limit, 10), 100))
  order by rank;
$$;

create or replace function public.get_operator_handle(p_wallet text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select handle from public.operators where wallet_pubkey = trim(p_wallet) limit 1;
$$;

create or replace function public.get_wallet_rank(p_wallet text, p_season_id integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      cs.wallet_pubkey,
      cs.yen_earned,
      cs.phase,
      row_number() over (order by cs.yen_earned desc, cs.updated_at asc) as rank
    from public.cycle_scores cs
    where cs.season_id = p_season_id and cs.phase >= 2 and cs.yen_earned > 0
  )
  select coalesce(
    (
      select jsonb_build_object(
        'rank', rank,
        'yen_earned', yen_earned,
        'phase', phase,
        'qualified', phase >= 2
      )
      from ranked
      where wallet_pubkey = trim(p_wallet)
    ),
    jsonb_build_object('rank', null, 'yen_earned', 0, 'phase', 1, 'qualified', false)
  );
$$;

grant execute on function public.register_operator(text, text) to anon, authenticated;
grant execute on function public.sync_cycle_score(text, integer, numeric, smallint) to anon, authenticated;
grant execute on function public.get_leaderboard(integer, integer) to anon, authenticated;
grant execute on function public.get_operator_handle(text) to anon, authenticated;
grant execute on function public.get_wallet_rank(text, integer) to anon, authenticated;
