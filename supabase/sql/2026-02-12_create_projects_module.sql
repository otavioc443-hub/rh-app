begin;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text null,
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  start_date date null,
  end_date date null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  company_id uuid null references public.companies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null check (member_role in ('gestor', 'coordenador', 'colaborador')),
  added_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table if not exists public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text null,
  due_date date null,
  assigned_to uuid null references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'sent', 'approved')),
  document_url text null,
  submitted_at timestamptz null,
  submitted_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deliverable_contributions (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.project_deliverables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contribution_note text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_owner on public.projects(owner_user_id);
create index if not exists idx_projects_company on public.projects(company_id);
create index if not exists idx_project_members_project on public.project_members(project_id);
create index if not exists idx_project_members_user on public.project_members(user_id);
create index if not exists idx_project_deliverables_project on public.project_deliverables(project_id);
create index if not exists idx_project_deliverables_assigned on public.project_deliverables(assigned_to);
create index if not exists idx_deliverable_contributions_deliverable on public.deliverable_contributions(deliverable_id);

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_project_deliverables_updated_at on public.project_deliverables;
create trigger trg_project_deliverables_updated_at
before update on public.project_deliverables
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_deliverables enable row level security;
alter table public.deliverable_contributions enable row level security;

drop policy if exists projects_select_member on public.projects;
create policy projects_select_member
on public.projects
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = projects.id
      and pm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
);

drop policy if exists projects_insert_gestor_admin_rh on public.projects;
create policy projects_insert_gestor_admin_rh
on public.projects
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('gestor', 'admin', 'rh')
  )
);

drop policy if exists projects_update_owner_admin_rh on public.projects;
create policy projects_update_owner_admin_rh
on public.projects
for update
to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
)
with check (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
);

drop policy if exists project_members_select_project_member on public.project_members;
create policy project_members_select_project_member
on public.project_members
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_members.project_id
      and pm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
);

drop policy if exists project_members_insert_manager on public.project_members;
create policy project_members_insert_manager
on public.project_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects pr
    where pr.id = project_members.project_id
      and (
        pr.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = pr.id
            and pm.user_id = auth.uid()
            and pm.member_role in ('gestor', 'coordenador')
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.active = true
            and p.role in ('admin', 'rh')
        )
      )
  )
);

drop policy if exists project_members_delete_manager on public.project_members;
create policy project_members_delete_manager
on public.project_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    where pr.id = project_members.project_id
      and (
        pr.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = pr.id
            and pm.user_id = auth.uid()
            and pm.member_role in ('gestor', 'coordenador')
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.active = true
            and p.role in ('admin', 'rh')
        )
      )
  )
);

drop policy if exists deliverables_select_project_member on public.project_deliverables;
create policy deliverables_select_project_member
on public.project_deliverables
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_deliverables.project_id
      and pm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
);

drop policy if exists deliverables_insert_manager on public.project_deliverables;
create policy deliverables_insert_manager
on public.project_deliverables
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects pr
    where pr.id = project_deliverables.project_id
      and (
        pr.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = pr.id
            and pm.user_id = auth.uid()
            and pm.member_role in ('gestor', 'coordenador')
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.active = true
            and p.role in ('admin', 'rh')
        )
      )
  )
);

drop policy if exists deliverables_update_member on public.project_deliverables;
create policy deliverables_update_member
on public.project_deliverables
for update
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_deliverables.project_id
      and pm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
)
with check (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_deliverables.project_id
      and pm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
);

drop policy if exists contributions_select_project_member on public.deliverable_contributions;
create policy contributions_select_project_member
on public.deliverable_contributions
for select
to authenticated
using (
  exists (
    select 1
    from public.project_deliverables d
    join public.project_members pm on pm.project_id = d.project_id
    where d.id = deliverable_contributions.deliverable_id
      and pm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
);

drop policy if exists contributions_insert_project_member on public.deliverable_contributions;
create policy contributions_insert_project_member
on public.deliverable_contributions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.project_deliverables d
    join public.project_members pm on pm.project_id = d.project_id
    where d.id = deliverable_contributions.deliverable_id
      and pm.user_id = auth.uid()
  )
);

commit;
