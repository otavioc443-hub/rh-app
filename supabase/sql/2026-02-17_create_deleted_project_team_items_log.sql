begin;

-- Historico de exclusao de equipes e remocao de membros (Projetos e P&D).
create table if not exists public.project_team_deleted_items (
  id uuid primary key default gen_random_uuid(),
  source_module text not null check (source_module in ('projects', 'pd_projects')),
  event_kind text not null check (event_kind in ('team_deleted', 'member_removed')),
  project_id uuid null references public.projects(id) on delete cascade,
  pd_project_id uuid null references public.pd_projects(id) on delete cascade,
  team_ref_id uuid null,
  team_name text null,
  user_id uuid null references auth.users(id) on delete set null,
  deleted_by uuid null references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb,
  check (
    (source_module = 'projects' and project_id is not null and pd_project_id is null)
    or (source_module = 'pd_projects' and pd_project_id is not null and project_id is null)
  )
);

create index if not exists idx_project_team_deleted_items_project
  on public.project_team_deleted_items(project_id, deleted_at desc);

create index if not exists idx_project_team_deleted_items_pd_project
  on public.project_team_deleted_items(pd_project_id, deleted_at desc);

create index if not exists idx_project_team_deleted_items_source_event
  on public.project_team_deleted_items(source_module, event_kind, deleted_at desc);

create or replace function public.log_project_team_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_team_deleted_items (
    source_module,
    event_kind,
    project_id,
    team_ref_id,
    team_name,
    deleted_by,
    snapshot
  )
  values (
    'projects',
    'team_deleted',
    old.project_id,
    old.id,
    old.name,
    auth.uid(),
    to_jsonb(old)
  );
  return old;
end;
$$;

create or replace function public.log_project_team_member_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_name text;
begin
  select t.name into v_team_name
  from public.project_teams t
  where t.id = old.team_id;

  insert into public.project_team_deleted_items (
    source_module,
    event_kind,
    project_id,
    team_ref_id,
    team_name,
    user_id,
    deleted_by,
    snapshot
  )
  values (
    'projects',
    'member_removed',
    old.project_id,
    old.team_id,
    v_team_name,
    old.user_id,
    auth.uid(),
    to_jsonb(old)
  );
  return old;
end;
$$;

create or replace function public.log_pd_project_team_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_team_deleted_items (
    source_module,
    event_kind,
    pd_project_id,
    team_ref_id,
    team_name,
    deleted_by,
    snapshot
  )
  values (
    'pd_projects',
    'team_deleted',
    old.project_id,
    old.id,
    old.name,
    auth.uid(),
    to_jsonb(old)
  );
  return old;
end;
$$;

create or replace function public.log_pd_project_team_member_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_name text;
begin
  select t.name into v_team_name
  from public.pd_project_teams t
  where t.id = old.team_id;

  insert into public.project_team_deleted_items (
    source_module,
    event_kind,
    pd_project_id,
    team_ref_id,
    team_name,
    user_id,
    deleted_by,
    snapshot
  )
  values (
    'pd_projects',
    'member_removed',
    old.project_id,
    old.team_id,
    v_team_name,
    old.user_id,
    auth.uid(),
    to_jsonb(old)
  );
  return old;
end;
$$;

drop trigger if exists trg_log_project_team_delete on public.project_teams;
create trigger trg_log_project_team_delete
before delete on public.project_teams
for each row execute function public.log_project_team_delete();

drop trigger if exists trg_log_project_team_member_delete on public.project_team_members;
create trigger trg_log_project_team_member_delete
before delete on public.project_team_members
for each row execute function public.log_project_team_member_delete();

drop trigger if exists trg_log_pd_project_team_delete on public.pd_project_teams;
create trigger trg_log_pd_project_team_delete
before delete on public.pd_project_teams
for each row execute function public.log_pd_project_team_delete();

drop trigger if exists trg_log_pd_project_team_member_delete on public.pd_project_team_members;
create trigger trg_log_pd_project_team_member_delete
before delete on public.pd_project_team_members
for each row execute function public.log_pd_project_team_member_delete();

alter table public.project_team_deleted_items enable row level security;

drop policy if exists project_team_deleted_items_select on public.project_team_deleted_items;
create policy project_team_deleted_items_select
on public.project_team_deleted_items
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or (
      source_module = 'projects'
      and exists (
        select 1
        from public.project_members pm
        where pm.project_id = project_team_deleted_items.project_id
          and pm.user_id = auth.uid()
      )
    )
    or (
      source_module = 'pd_projects'
      and public.pd_is_project_member(project_team_deleted_items.pd_project_id, auth.uid())
    )
  )
);

commit;
