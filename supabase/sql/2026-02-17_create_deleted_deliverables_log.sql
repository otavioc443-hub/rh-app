begin;

-- Historico centralizado de entregaveis excluidos (Projetos e P&D).
create table if not exists public.project_deliverable_deleted_items (
  id uuid primary key default gen_random_uuid(),
  source_module text not null check (source_module in ('projects', 'pd_projects')),
  project_id uuid null references public.projects(id) on delete cascade,
  pd_project_id uuid null references public.pd_projects(id) on delete cascade,
  deliverable_ref_id uuid not null,
  title text null,
  description text null,
  due_date date null,
  status text null,
  assigned_to uuid null references auth.users(id) on delete set null,
  deleted_by uuid null references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb,
  check (
    (source_module = 'projects' and project_id is not null and pd_project_id is null)
    or (source_module = 'pd_projects' and pd_project_id is not null and project_id is null)
  )
);

create index if not exists idx_deleted_deliverables_project
  on public.project_deliverable_deleted_items(project_id, deleted_at desc);

create index if not exists idx_deleted_deliverables_pd_project
  on public.project_deliverable_deleted_items(pd_project_id, deleted_at desc);

create index if not exists idx_deleted_deliverables_source
  on public.project_deliverable_deleted_items(source_module, deleted_at desc);

create or replace function public.log_project_deliverable_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_deliverable_deleted_items (
    source_module,
    project_id,
    deliverable_ref_id,
    title,
    description,
    due_date,
    status,
    assigned_to,
    deleted_by,
    snapshot
  )
  values (
    'projects',
    old.project_id,
    old.id,
    old.title,
    old.description,
    old.due_date,
    old.status,
    old.assigned_to,
    auth.uid(),
    to_jsonb(old)
  );
  return old;
end;
$$;

create or replace function public.log_pd_project_deliverable_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_deliverable_deleted_items (
    source_module,
    pd_project_id,
    deliverable_ref_id,
    title,
    description,
    due_date,
    status,
    assigned_to,
    deleted_by,
    snapshot
  )
  values (
    'pd_projects',
    old.project_id,
    old.id,
    old.title,
    old.description,
    old.due_date,
    old.status,
    old.assigned_to,
    auth.uid(),
    to_jsonb(old)
  );
  return old;
end;
$$;

drop trigger if exists trg_log_project_deliverable_delete on public.project_deliverables;
create trigger trg_log_project_deliverable_delete
before delete on public.project_deliverables
for each row execute function public.log_project_deliverable_delete();

drop trigger if exists trg_log_pd_project_deliverable_delete on public.pd_project_deliverables;
create trigger trg_log_pd_project_deliverable_delete
before delete on public.pd_project_deliverables
for each row execute function public.log_pd_project_deliverable_delete();

alter table public.project_deliverable_deleted_items enable row level security;

drop policy if exists deleted_deliverables_select on public.project_deliverable_deleted_items;
create policy deleted_deliverables_select
on public.project_deliverable_deleted_items
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
        where pm.project_id = project_deliverable_deleted_items.project_id
          and pm.user_id = auth.uid()
      )
    )
    or (
      source_module = 'pd_projects'
      and public.pd_is_project_member(project_deliverable_deleted_items.pd_project_id, auth.uid())
    )
  )
);

commit;
