-- Apply security hardening from migration 800 (was marked applied via repair but never run).

alter table public.season_payouts enable row level security;

alter table public.cycle_scores
  add column if not exists last_clamp_reason text;

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
