-- Fix cheat_suspects grants left on anon/authenticated from migration 500.

revoke all on public.cheat_suspects from public, anon, authenticated;
revoke all on function public.get_cheat_suspects(integer) from public, anon, authenticated;

grant select on public.cheat_suspects to service_role;
grant execute on function public.get_cheat_suspects(integer) to service_role;
