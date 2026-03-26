begin;

create table if not exists public.user_xp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  department_id uuid null references public.departments(id) on delete set null,
  total_xp integer not null default 0,
  level integer not null default 1,
  season_xp integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text null,
  icon_name text null,
  accent_color text null,
  points_reward integer not null default 0,
  criteria_key text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  season_key text null,
  unique (user_id, badge_id)
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  title text not null,
  description text null,
  challenge_type text not null check (challenge_type in ('daily','weekly','seasonal','battle')),
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  target_metric text null,
  target_value integer null,
  xp_reward integer not null default 0,
  reward_label text null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  progress_value integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz null,
  rank_position integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  session_type text not null check (session_type in ('quiz_rush','battle','challenge','season')),
  status text not null default 'scheduled' check (status in ('scheduled','live','finished','cancelled')),
  title text not null,
  description text null,
  course_id uuid null references public.lms_courses(id) on delete cascade,
  quiz_id uuid null references public.lms_quizzes(id) on delete cascade,
  created_by uuid null references public.profiles(id) on delete set null,
  started_at timestamptz null,
  ended_at timestamptz null,
  max_participants integer null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.leaderboards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  department_id uuid null references public.departments(id) on delete set null,
  scope text not null default 'company',
  title text not null,
  season_key text not null,
  payload jsonb not null default '[]'::jsonb,
  refreshed_at timestamptz not null default now()
);

create table if not exists public.user_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_activity_on date null,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  title text not null,
  action_key text not null,
  xp_reward integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_xp_company on public.user_xp(company_id, total_xp desc);
create index if not exists idx_user_xp_department on public.user_xp(department_id, total_xp desc);
create index if not exists idx_user_badges_user on public.user_badges(user_id, awarded_at desc);
create index if not exists idx_challenges_company_status on public.challenges(company_id, status, ends_at);
create index if not exists idx_challenge_participants_user on public.challenge_participants(user_id, updated_at desc);
create index if not exists idx_game_sessions_company on public.game_sessions(company_id, status, created_at desc);
create index if not exists idx_leaderboards_scope on public.leaderboards(company_id, department_id, season_key, refreshed_at desc);
create index if not exists idx_user_streaks_user on public.user_streaks(user_id, current_streak desc);
create index if not exists idx_reward_rules_action on public.reward_rules(company_id, action_key, is_active);

alter table public.user_xp enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.game_sessions enable row level security;
alter table public.leaderboards enable row level security;
alter table public.user_streaks enable row level security;
alter table public.reward_rules enable row level security;

drop policy if exists user_xp_select on public.user_xp;
create policy user_xp_select on public.user_xp for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
  or exists (select 1 from public.profiles p where p.id = user_xp.user_id and p.manager_id = auth.uid())
);

drop policy if exists user_xp_manage on public.user_xp;
create policy user_xp_manage on public.user_xp for all to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists badges_read on public.badges;
create policy badges_read on public.badges for select to authenticated using (true);

drop policy if exists badges_manage on public.badges;
create policy badges_manage on public.badges for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
  or exists (select 1 from public.profiles p where p.id = user_badges.user_id and p.manager_id = auth.uid())
);

drop policy if exists user_badges_manage on public.user_badges;
create policy user_badges_manage on public.user_badges for all to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists challenges_read on public.challenges;
create policy challenges_read on public.challenges for select to authenticated using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (challenges.company_id is null or p.company_id is null or challenges.company_id = p.company_id)
  )
);

drop policy if exists challenges_manage on public.challenges;
create policy challenges_manage on public.challenges for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists challenge_participants_select on public.challenge_participants;
create policy challenge_participants_select on public.challenge_participants for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
  or exists (select 1 from public.profiles p where p.id = challenge_participants.user_id and p.manager_id = auth.uid())
);

drop policy if exists challenge_participants_manage on public.challenge_participants;
create policy challenge_participants_manage on public.challenge_participants for all to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists game_sessions_read on public.game_sessions;
create policy game_sessions_read on public.game_sessions for select to authenticated using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (game_sessions.company_id is null or p.company_id is null or game_sessions.company_id = p.company_id)
  )
);

drop policy if exists game_sessions_manage on public.game_sessions;
create policy game_sessions_manage on public.game_sessions for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists leaderboards_read on public.leaderboards;
create policy leaderboards_read on public.leaderboards for select to authenticated using (true);

drop policy if exists leaderboards_manage on public.leaderboards;
create policy leaderboards_manage on public.leaderboards for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists user_streaks_select on public.user_streaks;
create policy user_streaks_select on public.user_streaks for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
  or exists (select 1 from public.profiles p where p.id = user_streaks.user_id and p.manager_id = auth.uid())
);

drop policy if exists user_streaks_manage on public.user_streaks;
create policy user_streaks_manage on public.user_streaks for all to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists reward_rules_read on public.reward_rules;
create policy reward_rules_read on public.reward_rules for select to authenticated using (true);

drop policy if exists reward_rules_manage on public.reward_rules;
create policy reward_rules_manage on public.reward_rules for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

insert into public.badges (slug, title, description, icon_name, accent_color, points_reward, criteria_key)
values
  ('primeiro-xp', 'Primeiro XP', 'Primeiro passo concluído na jornada gamificada.', 'sparkles', '#0f172a', 10, 'xp_first'),
  ('curso-concluido', 'Curso concluído', 'Concluiu o primeiro treinamento com sucesso.', 'graduation-cap', '#16a34a', 20, 'course_completed'),
  ('maratonista', 'Maratonista', 'Alcançou sete dias consecutivos estudando.', 'flame', '#ea580c', 40, 'streak_7'),
  ('quiz-perfect', 'Quiz perfect', 'Atingiu 100% de acerto em um quiz.', 'target', '#2563eb', 30, 'quiz_perfect'),
  ('lenda-do-aprendizado', 'Lenda do aprendizado', 'Chegou ao nível 5 de evolução.', 'crown', '#a21caf', 60, 'level_5'),
  ('colecionador-de-certificados', 'Colecionador de certificados', 'Concluiu múltiplos cursos certificados.', 'award', '#ca8a04', 50, 'certificates_5'),
  ('ritmo-constante', 'Ritmo constante', 'Manteve consistência de estudo por três dias.', 'clock', '#0891b2', 20, 'streak_3')
on conflict (slug) do nothing;

insert into public.reward_rules (company_id, title, action_key, xp_reward, is_active)
values
  (null, 'XP por aula concluída', 'lesson_completed', 25, true),
  (null, 'XP por curso concluído', 'course_completed', 150, true),
  (null, 'XP por quiz aprovado', 'quiz_passed', 70, true),
  (null, 'Bônus por quiz perfeito', 'quiz_perfect', 30, true),
  (null, 'XP por certificado emitido', 'certificate_issued', 40, true),
  (null, 'XP por dia de streak', 'streak_day', 15, true),
  (null, 'XP por desafio concluído', 'challenge_completed', 120, true),
  (null, 'XP por participar de batalha', 'battle_participation', 50, true)
on conflict do nothing;

commit;
