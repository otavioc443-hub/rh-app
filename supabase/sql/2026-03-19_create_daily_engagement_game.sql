create table if not exists public.engagement_game_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text null,
  game_type text not null default 'pulse_sprint' check (game_type in ('pulse_sprint')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'archived')),
  rules_json jsonb not null default '{}'::jsonb,
  reward_json jsonb not null default '{}'::jsonb,
  start_date date null,
  end_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engagement_game_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete set null,
  department_id uuid null references public.departments(id) on delete set null,
  display_name text not null,
  department_name text null,
  game_slug text not null default 'pulse-sprint',
  score_current integer not null default 0 check (score_current >= 0),
  score_total integer not null default 0 check (score_total >= 0),
  sessions_played integer not null default 0 check (sessions_played >= 0),
  streak integer not null default 0 check (streak >= 0),
  best_session_score integer not null default 0 check (best_session_score >= 0),
  last_played_date date null,
  last_session_id uuid null,
  reset_status text not null default 'ready' check (reset_status in ('ready', 'played_today', 'reset_after_miss')),
  last_reset_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_engagement_game_players_company_score
  on public.engagement_game_players(company_id, score_current desc, updated_at desc);

create table if not exists public.engagement_game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete set null,
  department_id uuid null references public.departments(id) on delete set null,
  game_slug text not null default 'pulse-sprint',
  play_date date not null default (timezone('America/Fortaleza', now())::date),
  session_state text not null default 'started' check (session_state in ('started', 'completed', 'expired', 'cancelled')),
  challenge_seed text not null,
  challenge_config jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  hit_count integer not null default 0 check (hit_count >= 0),
  miss_count integer not null default 0 check (miss_count >= 0),
  accuracy numeric(5,2) not null default 0,
  avg_reaction_ms integer null,
  combo_best integer not null default 0 check (combo_best >= 0),
  base_points integer not null default 0 check (base_points >= 0),
  performance_points integer not null default 0 check (performance_points >= 0),
  streak_bonus integer not null default 0 check (streak_bonus >= 0),
  total_points_awarded integer not null default 0 check (total_points_awarded >= 0),
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_engagement_game_sessions_completed_once_per_day
  on public.engagement_game_sessions(user_id, play_date)
  where session_state = 'completed';

create index if not exists idx_engagement_game_sessions_company_day
  on public.engagement_game_sessions(company_id, play_date desc, total_points_awarded desc);

create index if not exists idx_engagement_game_sessions_user_state
  on public.engagement_game_sessions(user_id, session_state, created_at desc);

alter table public.engagement_game_players
  add constraint engagement_game_players_last_session_fk
  foreign key (last_session_id)
  references public.engagement_game_sessions(id)
  on delete set null;

create table if not exists public.engagement_game_score_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete set null,
  session_id uuid null references public.engagement_game_sessions(id) on delete set null,
  event_type text not null check (event_type in ('play_awarded', 'reset_after_miss', 'manual_adjustment', 'campaign_bonus')),
  points_delta integer not null default 0,
  score_current_after integer not null default 0 check (score_current_after >= 0),
  score_total_after integer not null default 0 check (score_total_after >= 0),
  streak_after integer not null default 0 check (streak_after >= 0),
  event_date date not null default (timezone('America/Fortaleza', now())::date),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_engagement_game_score_history_user_date
  on public.engagement_game_score_history(user_id, event_date desc, created_at desc);

create or replace function public.engagement_game_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_engagement_game_campaigns_updated_at on public.engagement_game_campaigns;
create trigger trg_engagement_game_campaigns_updated_at
before update on public.engagement_game_campaigns
for each row execute function public.engagement_game_touch_updated_at();

drop trigger if exists trg_engagement_game_players_updated_at on public.engagement_game_players;
create trigger trg_engagement_game_players_updated_at
before update on public.engagement_game_players
for each row execute function public.engagement_game_touch_updated_at();

drop trigger if exists trg_engagement_game_sessions_updated_at on public.engagement_game_sessions;
create trigger trg_engagement_game_sessions_updated_at
before update on public.engagement_game_sessions
for each row execute function public.engagement_game_touch_updated_at();

create or replace function public.engagement_game_current_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    p.company_id,
    (
      select d.company_id
      from public.departments d
      where d.id = p.department_id
      limit 1
    )
  )
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

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
  with stale as (
    update public.engagement_game_players p
       set score_current = 0,
           streak = 0,
           reset_status = 'reset_after_miss',
           last_reset_at = now(),
           updated_at = now()
     where p.last_played_date is not null
       and p.last_played_date < (v_today - 1)
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
      'reason', 'missed_day',
      'previous_current_score', s.score_current,
      'last_played_date', s.last_played_date
    )
  from stale s;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace view public.engagement_game_leaderboard as
select
  p.company_id,
  p.user_id,
  p.display_name,
  p.department_name,
  p.score_current,
  p.score_total,
  p.streak,
  p.last_played_date,
  p.best_session_score,
  rank() over (
    partition by p.company_id
    order by p.score_current desc, p.streak desc, p.last_played_date desc nulls last, p.updated_at asc
  ) as rank_position
from public.engagement_game_players p
where p.score_current > 0;

alter table public.engagement_game_campaigns enable row level security;
alter table public.engagement_game_players enable row level security;
alter table public.engagement_game_sessions enable row level security;
alter table public.engagement_game_score_history enable row level security;

drop policy if exists engagement_game_campaigns_select on public.engagement_game_campaigns;
create policy engagement_game_campaigns_select
on public.engagement_game_campaigns
for select
to authenticated
using (
  company_id is null or company_id = public.engagement_game_current_company_id()
);

drop policy if exists engagement_game_players_select_company on public.engagement_game_players;
create policy engagement_game_players_select_company
on public.engagement_game_players
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    company_id is not null
    and company_id = public.engagement_game_current_company_id()
  )
);

drop policy if exists engagement_game_sessions_select_own on public.engagement_game_sessions;
create policy engagement_game_sessions_select_own
on public.engagement_game_sessions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists engagement_game_score_history_select_own on public.engagement_game_score_history;
create policy engagement_game_score_history_select_own
on public.engagement_game_score_history
for select
to authenticated
using (user_id = auth.uid());

grant execute on function public.engagement_game_current_company_id() to authenticated;
grant execute on function public.engagement_game_sync_all_resets() to authenticated;
