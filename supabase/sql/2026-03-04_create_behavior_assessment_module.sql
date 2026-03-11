begin;

create table if not exists public.behavior_adjectives (
  id text primary key,
  label text not null,
  attention boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.behavior_adjective_weights (
  adjective_id text not null references public.behavior_adjectives(id) on delete cascade,
  axis text not null check (axis in ('executor', 'comunicador', 'planejador', 'analista')),
  weight smallint not null check (weight between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (adjective_id, axis)
);

create table if not exists public.behavior_assessment_invites (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid null references public.colaboradores(id) on delete set null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired', 'cancelled')),
  expires_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.behavior_assessment_releases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collaborator_id uuid null references public.colaboradores(id) on delete set null,
  window_start date not null,
  window_end date not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint behavior_assessment_releases_window_check check (window_end >= window_start)
);

create table if not exists public.behavior_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete cascade,
  collaborator_id uuid null references public.colaboradores(id) on delete set null,
  invite_id uuid null references public.behavior_assessment_invites(id) on delete set null,
  full_name text not null,
  email text not null,
  self_selected_ids text[] not null default '{}',
  others_selected_ids text[] not null default '{}',
  self_result jsonb not null,
  others_result jsonb not null,
  predominant_self text[] not null default '{}',
  predominant_others text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_behavior_adjective_weights_axis
  on public.behavior_adjective_weights(axis);

create index if not exists idx_behavior_assessment_invites_invited_by_created
  on public.behavior_assessment_invites(invited_by, created_at desc);

create index if not exists idx_behavior_assessment_releases_user_created
  on public.behavior_assessment_releases(user_id, created_at desc);

create index if not exists idx_behavior_assessment_releases_collaborator_created
  on public.behavior_assessment_releases(collaborator_id, created_at desc);

create index if not exists idx_behavior_assessments_user_created
  on public.behavior_assessments(user_id, created_at desc);

create index if not exists idx_behavior_assessments_collaborator_created
  on public.behavior_assessments(collaborator_id, created_at desc);

alter table public.behavior_adjectives enable row level security;
alter table public.behavior_adjective_weights enable row level security;
alter table public.behavior_assessment_invites enable row level security;
alter table public.behavior_assessment_releases enable row level security;
alter table public.behavior_assessments enable row level security;

drop policy if exists behavior_adjectives_select_auth on public.behavior_adjectives;
create policy behavior_adjectives_select_auth
on public.behavior_adjectives
for select
to authenticated
using (true);

drop policy if exists behavior_adjective_weights_select_auth on public.behavior_adjective_weights;
create policy behavior_adjective_weights_select_auth
on public.behavior_adjective_weights
for select
to authenticated
using (true);

drop policy if exists behavior_assessment_invites_select_owner on public.behavior_assessment_invites;
create policy behavior_assessment_invites_select_owner
on public.behavior_assessment_invites
for select
to authenticated
using (
  public.current_role() in ('admin', 'rh')
  or
  invited_by = auth.uid()
  or exists (
    select 1
    from public.colaboradores c
    where c.id = collaborator_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists behavior_assessment_invites_insert_owner on public.behavior_assessment_invites;
create policy behavior_assessment_invites_insert_owner
on public.behavior_assessment_invites
for insert
to authenticated
with check (
  invited_by = auth.uid()
  and public.current_role() in ('admin', 'rh')
);

drop policy if exists behavior_assessment_releases_select_scope on public.behavior_assessment_releases;
create policy behavior_assessment_releases_select_scope
on public.behavior_assessment_releases
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_role() in ('admin', 'rh')
);

drop policy if exists behavior_assessment_releases_insert_rh_admin on public.behavior_assessment_releases;
create policy behavior_assessment_releases_insert_rh_admin
on public.behavior_assessment_releases
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.current_role() in ('admin', 'rh')
);

drop policy if exists behavior_assessment_releases_update_rh_admin on public.behavior_assessment_releases;
create policy behavior_assessment_releases_update_rh_admin
on public.behavior_assessment_releases
for update
to authenticated
using (public.current_role() in ('admin', 'rh'))
with check (public.current_role() in ('admin', 'rh'));

drop policy if exists behavior_assessment_releases_delete_rh_admin on public.behavior_assessment_releases;
create policy behavior_assessment_releases_delete_rh_admin
on public.behavior_assessment_releases
for delete
to authenticated
using (public.current_role() in ('admin', 'rh'));

drop policy if exists behavior_assessments_select_own on public.behavior_assessments;
create policy behavior_assessments_select_own
on public.behavior_assessments
for select
to authenticated
using (
  public.current_role() in ('admin', 'rh')
  or
  user_id = auth.uid()
  or exists (
    select 1
    from public.colaboradores c
    where c.id = collaborator_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists behavior_assessments_insert_own on public.behavior_assessments;
create policy behavior_assessments_insert_own
on public.behavior_assessments
for insert
to authenticated
with check (
  (
    invite_id is not null
    and user_id is null
  )
  or
  (
    user_id = auth.uid()
    and exists (
      select 1
      from public.behavior_assessment_releases r
      where r.user_id = auth.uid()
        and r.is_active = true
        and current_date between r.window_start and r.window_end
    )
  )
);

commit;
