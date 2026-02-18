begin;

-- Projetos internos de P&D.
create table if not exists public.pd_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text null,
  status text not null default 'planning' check (status in ('planning', 'active', 'paused', 'done', 'cancelled')),
  start_date date null,
  end_date date null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pd_projects_owner on public.pd_projects(owner_user_id, created_at desc);
create index if not exists idx_pd_projects_status on public.pd_projects(status, created_at desc);

drop trigger if exists trg_pd_projects_updated_at on public.pd_projects;
create trigger trg_pd_projects_updated_at
before update on public.pd_projects
for each row execute function public.set_updated_at();

create table if not exists public.pd_project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.pd_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null check (member_role in ('gestor_pd', 'coordenador_pd', 'executor')),
  is_active boolean not null default true,
  added_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists idx_pd_project_members_project on public.pd_project_members(project_id, created_at desc);
create index if not exists idx_pd_project_members_user on public.pd_project_members(user_id, created_at desc);

drop trigger if exists trg_pd_project_members_updated_at on public.pd_project_members;
create trigger trg_pd_project_members_updated_at
before update on public.pd_project_members
for each row execute function public.set_updated_at();

create table if not exists public.pd_project_teams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.pd_projects(id) on delete cascade,
  name text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create index if not exists idx_pd_project_teams_project on public.pd_project_teams(project_id, created_at desc);

drop trigger if exists trg_pd_project_teams_updated_at on public.pd_project_teams;
create trigger trg_pd_project_teams_updated_at
before update on public.pd_project_teams
for each row execute function public.set_updated_at();

create table if not exists public.pd_project_team_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.pd_projects(id) on delete cascade,
  team_id uuid not null references public.pd_project_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists idx_pd_project_team_members_team on public.pd_project_team_members(team_id, created_at desc);
create index if not exists idx_pd_project_team_members_project on public.pd_project_team_members(project_id, created_at desc);

create table if not exists public.pd_project_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.pd_projects(id) on delete cascade,
  title text not null,
  description text null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'review', 'done', 'blocked', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  due_date date null,
  assigned_to uuid null references auth.users(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pd_project_actions_project on public.pd_project_actions(project_id, created_at desc);
create index if not exists idx_pd_project_actions_assigned on public.pd_project_actions(assigned_to, created_at desc);
create index if not exists idx_pd_project_actions_status on public.pd_project_actions(status, priority, due_date);

drop trigger if exists trg_pd_project_actions_updated_at on public.pd_project_actions;
create trigger trg_pd_project_actions_updated_at
before update on public.pd_project_actions
for each row execute function public.set_updated_at();

-- Ao criar projeto, inclui automaticamente o dono como gestor de P&D.
create or replace function public.pd_project_add_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pd_project_members (project_id, user_id, member_role, is_active, added_by)
  values (new.id, new.owner_user_id, 'gestor_pd', true, coalesce(new.created_by, new.owner_user_id))
  on conflict (project_id, user_id) do update
  set member_role = excluded.member_role,
      is_active = true,
      added_by = excluded.added_by,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pd_projects_owner_member on public.pd_projects;
create trigger trg_pd_projects_owner_member
after insert on public.pd_projects
for each row execute function public.pd_project_add_owner_member();

alter table public.pd_projects enable row level security;
alter table public.pd_project_members enable row level security;
alter table public.pd_project_teams enable row level security;
alter table public.pd_project_team_members enable row level security;
alter table public.pd_project_actions enable row level security;

-- Select comum: membros do projeto + papeis de governanca.
drop policy if exists pd_projects_select on public.pd_projects;
create policy pd_projects_select
on public.pd_projects
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or owner_user_id = auth.uid()
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_projects.id
        and m.user_id = auth.uid()
        and m.is_active = true
    )
  )
);

drop policy if exists pd_projects_insert on public.pd_projects;
create policy pd_projects_insert
on public.pd_projects
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'gestor')
  and owner_user_id = auth.uid()
);

drop policy if exists pd_projects_update on public.pd_projects;
create policy pd_projects_update
on public.pd_projects
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or owner_user_id = auth.uid()
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_projects.id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or owner_user_id = auth.uid()
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_projects.id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
);

drop policy if exists pd_projects_delete on public.pd_projects;
create policy pd_projects_delete
on public.pd_projects
for delete
to authenticated
using (
  public.current_active() = true
  and (public.current_role() = 'admin' or owner_user_id = auth.uid())
);

drop policy if exists pd_project_members_select on public.pd_project_members;
create policy pd_project_members_select
on public.pd_project_members
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or user_id = auth.uid()
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_members.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
    )
  )
);

drop policy if exists pd_project_members_insert on public.pd_project_members;
create policy pd_project_members_insert
on public.pd_project_members
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_members.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
);

drop policy if exists pd_project_members_update on public.pd_project_members;
create policy pd_project_members_update
on public.pd_project_members
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_members.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_members.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
);

drop policy if exists pd_project_members_delete on public.pd_project_members;
create policy pd_project_members_delete
on public.pd_project_members
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_members.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
);

drop policy if exists pd_project_teams_select on public.pd_project_teams;
create policy pd_project_teams_select
on public.pd_project_teams
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_teams.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
    )
  )
);

drop policy if exists pd_project_teams_insert on public.pd_project_teams;
create policy pd_project_teams_insert
on public.pd_project_teams
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_teams.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_teams.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
);

drop policy if exists pd_project_teams_update on public.pd_project_teams;
create policy pd_project_teams_update
on public.pd_project_teams
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_teams.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_teams.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_teams.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_teams.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
);

drop policy if exists pd_project_teams_delete on public.pd_project_teams;
create policy pd_project_teams_delete
on public.pd_project_teams
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_teams.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_teams.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
);

drop policy if exists pd_project_team_members_select on public.pd_project_team_members;
create policy pd_project_team_members_select
on public.pd_project_team_members
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or user_id = auth.uid()
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_team_members.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
    )
  )
);

drop policy if exists pd_project_team_members_insert on public.pd_project_team_members;
create policy pd_project_team_members_insert
on public.pd_project_team_members
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_team_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_team_members.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
);

drop policy if exists pd_project_team_members_delete on public.pd_project_team_members;
create policy pd_project_team_members_delete
on public.pd_project_team_members
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_team_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_team_members.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
);

drop policy if exists pd_project_actions_select on public.pd_project_actions;
create policy pd_project_actions_select
on public.pd_project_actions
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or assigned_to = auth.uid()
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_actions.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
    )
  )
);

drop policy if exists pd_project_actions_insert on public.pd_project_actions;
create policy pd_project_actions_insert
on public.pd_project_actions
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_actions.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_actions.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role in ('gestor_pd', 'coordenador_pd')
    )
  )
);

drop policy if exists pd_project_actions_update on public.pd_project_actions;
create policy pd_project_actions_update
on public.pd_project_actions
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or assigned_to = auth.uid()
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_actions.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_actions.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role in ('gestor_pd', 'coordenador_pd')
    )
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or assigned_to = auth.uid()
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_actions.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_actions.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role in ('gestor_pd', 'coordenador_pd')
    )
  )
);

drop policy if exists pd_project_actions_delete on public.pd_project_actions;
create policy pd_project_actions_delete
on public.pd_project_actions
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_actions.project_id
        and p.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.pd_project_members m
      where m.project_id = pd_project_actions.project_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.member_role = 'gestor_pd'
    )
  )
);

commit;
