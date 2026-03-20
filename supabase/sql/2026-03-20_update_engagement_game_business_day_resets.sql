create or replace function public.engagement_game_sync_all_resets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := timezone('America/Fortaleza', now())::date;
  v_count integer := 0;
begin
  if extract(isodow from v_today) in (6, 7) then
    return 0;
  end if;

  with stale as (
    update public.engagement_game_players p
       set score_current = 0,
           streak = 0,
           reset_status = 'reset_after_miss',
           last_reset_at = now(),
           updated_at = now()
     where p.last_played_date is not null
       and (
         select count(*)
         from generate_series(p.last_played_date + 1, v_today, interval '1 day') as d(day)
         where extract(isodow from d.day) between 1 and 5
       ) > 1
       and (p.score_current > 0 or p.streak > 0 or p.reset_status <> 'reset_after_miss')
    returning p.user_id, p.company_id, p.score_total, p.score_current, p.last_played_date
  )
  insert into public.engagement_game_score_history (
    user_id,
    company_id,
    event_type,
    points_delta,
    score_current_after,
    score_total_after,
    streak_after,
    event_date,
    meta
  )
  select
    s.user_id,
    s.company_id,
    'reset_after_miss',
    0,
    0,
    s.score_total,
    0,
    v_today,
    jsonb_build_object(
      'reason', 'missed_business_day',
      'previous_current_score', s.score_current,
      'last_played_date', s.last_played_date
    )
  from stale s;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
