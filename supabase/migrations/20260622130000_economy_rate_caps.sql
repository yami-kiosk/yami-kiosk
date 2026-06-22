-- Rebalance server-side $YEN sync caps after economy anti-inflation pass
-- Allows ~1.35× max legitimate rate/min between syncs (matches sync_cycle_score)

create or replace function public.max_yen_per_minute(p_phase smallint)
returns numeric
language sql
immutable
as $$
  select case p_phase
    when 1 then 30
    when 2 then 85
    when 3 then 220
    when 4 then 650
    when 5 then 2400
    when 6 then 9500
    else 30
  end;
$$;
