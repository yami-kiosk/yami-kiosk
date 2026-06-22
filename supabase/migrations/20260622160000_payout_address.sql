-- Optional season payout destination (separate from burner identity wallet).

alter table public.operators
  add column if not exists payout_pubkey text;

comment on column public.operators.payout_pubkey is
  'Optional SPL payout destination. NULL = pay to wallet_pubkey (burner).';

create or replace function public.is_valid_solana_address(p_address text)
returns boolean
language sql
immutable
as $$
  select p_address is not null
    and length(trim(p_address)) between 32 and 44
    and trim(p_address) ~ '^[1-9A-HJ-NP-Za-km-z]+$';
$$;

create or replace function public.get_operator_payout(p_wallet text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet text := trim(p_wallet);
  v_burner text;
  v_payout text;
begin
  if v_wallet is null or length(v_wallet) < 32 then
    return jsonb_build_object('success', false, 'code', 'INVALID', 'message', 'Invalid wallet.');
  end if;

  select wallet_pubkey, payout_pubkey
    into v_burner, v_payout
    from public.operators
   where wallet_pubkey = v_wallet;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_REGISTERED',
      'message', 'Operator not registered on syndicate network.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'burner_pubkey', v_burner,
    'payout_pubkey', v_payout,
    'effective_pubkey', coalesce(nullif(trim(v_payout), ''), v_burner)
  );
end;
$$;

create or replace function public.set_operator_payout(p_wallet text, p_payout_pubkey text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet text := trim(p_wallet);
  v_payout text := nullif(trim(coalesce(p_payout_pubkey, '')), '');
  v_burner text;
begin
  if v_wallet is null or length(v_wallet) < 32 then
    return jsonb_build_object('success', false, 'code', 'INVALID', 'message', 'Invalid wallet.');
  end if;

  select wallet_pubkey into v_burner
    from public.operators
   where wallet_pubkey = v_wallet;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_REGISTERED',
      'message', 'Register your operator handle before setting a payout address.'
    );
  end if;

  if v_payout is not null then
    if not public.is_valid_solana_address(v_payout) then
      return jsonb_build_object(
        'success', false,
        'code', 'INVALID',
        'message', 'Not a valid Solana address (base58, 32–44 chars).'
      );
    end if;

    if v_payout = v_burner then
      v_payout := null;
    end if;
  end if;

  update public.operators
     set payout_pubkey = v_payout
   where wallet_pubkey = v_wallet;

  return jsonb_build_object(
    'success', true,
    'payout_pubkey', v_payout,
    'effective_pubkey', coalesce(v_payout, v_burner)
  );
end;
$$;

grant execute on function public.get_operator_payout(text) to anon, authenticated;
grant execute on function public.set_operator_payout(text, text) to anon, authenticated;
