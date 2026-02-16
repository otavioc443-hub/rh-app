begin;

-- Equipes nomeadas por projeto (ex: Civil, Eletrica, etc)
create table if not exists public.project_teams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists public.project_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.project_teams(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists idx_project_teams_project on public.project_teams(project_id);
create index if not exists idx_project_team_members_project on public.project_team_members(project_id);
create index if not exists idx_project_team_members_user on public.project_team_members(user_id);

drop trigger if exists trg_project_teams_updated_at on public.project_teams;
create trigger trg_project_teams_updated_at
before update on public.project_teams
for each row execute function public.set_updated_at();

alter table public.project_teams enable row level security;
alter table public.project_team_members enable row level security;

-- Helpers: permissao por projeto
-- Select: qualquer membro do projeto (ou admin/rh/financeiro) pode ver.
drop policy if exists project_teams_select_project_member on public.project_teams;
create policy project_teams_select_project_member
on public.project_teams
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_teams.project_id
      and pm.user_id = auth.uid()
  )
  or public.current_role() in ('admin','rh','financeiro')
);

drop policy if exists project_team_members_select_project_member on public.project_team_members;
create policy project_team_members_select_project_member
on public.project_team_members
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_team_members.project_id
      and pm.user_id = auth.uid()
  )
  or public.current_role() in ('admin','rh','financeiro')
);

-- Write: gestor/coordenador do projeto, owner, ou admin/rh.
drop policy if exists project_teams_write_manager on public.project_teams;
create policy project_teams_write_manager
on public.project_teams
for all
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    where pr.id = project_teams.project_id
      and pr.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_teams.project_id
      and pm.user_id = auth.uid()
      and pm.member_role in ('gestor','coordenador')
  )
  or public.current_role() in ('admin','rh')
)
with check (
  exists (
    select 1
    from public.projects pr
    where pr.id = project_teams.project_id
      and pr.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_teams.project_id
      and pm.user_id = auth.uid()
      and pm.member_role in ('gestor','coordenador')
  )
  or public.current_role() in ('admin','rh')
);

drop policy if exists project_team_members_write_manager on public.project_team_members;
create policy project_team_members_write_manager
on public.project_team_members
for all
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    where pr.id = project_team_members.project_id
      and pr.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_team_members.project_id
      and pm.user_id = auth.uid()
      and pm.member_role in ('gestor','coordenador')
  )
  or public.current_role() in ('admin','rh')
)
with check (
  -- garante que o usuario pertence ao projeto
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_team_members.project_id
      and pm.user_id = project_team_members.user_id
  )
  and (
    exists (
      select 1
      from public.projects pr
      where pr.id = project_team_members.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_team_members.project_id
        and pm.user_id = auth.uid()
        and pm.member_role in ('gestor','coordenador')
    )
    or public.current_role() in ('admin','rh')
  )
);

commit;

