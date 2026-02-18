begin;

create table if not exists public.pd_project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.pd_projects(id) on delete cascade,
  title text not null,
  description text null,
  due_date date null,
  assigned_to uuid null references auth.users(id) on delete set null,
  status text not null default 'pending' check (
    status in ('pending', 'in_progress', 'sent', 'approved', 'approved_with_comments', 'blocked', 'cancelled')
  ),
  approval_comment text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pd_project_deliverables_project
  on public.pd_project_deliverables(project_id, due_date, created_at desc);

create index if not exists idx_pd_project_deliverables_assigned
  on public.pd_project_deliverables(assigned_to, created_at desc);

drop trigger if exists trg_pd_project_deliverables_updated_at on public.pd_project_deliverables;
create trigger trg_pd_project_deliverables_updated_at
before update on public.pd_project_deliverables
for each row execute function public.set_updated_at();

create table if not exists public.pd_project_deliverable_timeline (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.pd_project_deliverables(id) on delete cascade,
  project_id uuid not null references public.pd_projects(id) on delete cascade,
  event_type text not null,
  status_from text null,
  status_to text null,
  comment text null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pd_project_deliverable_timeline_deliverable
  on public.pd_project_deliverable_timeline(deliverable_id, created_at desc);

create index if not exists idx_pd_project_deliverable_timeline_project
  on public.pd_project_deliverable_timeline(project_id, created_at desc);

alter table public.pd_project_deliverables enable row level security;
alter table public.pd_project_deliverable_timeline enable row level security;

drop policy if exists pd_project_deliverables_select on public.pd_project_deliverables;
create policy pd_project_deliverables_select
on public.pd_project_deliverables
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or assigned_to = auth.uid()
    or public.pd_is_project_member(project_id, auth.uid())
  )
);

drop policy if exists pd_project_deliverables_insert on public.pd_project_deliverables;
create policy pd_project_deliverables_insert
on public.pd_project_deliverables
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_deliverables.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor_or_coordenador(project_id, auth.uid())
  )
);

drop policy if exists pd_project_deliverables_update on public.pd_project_deliverables;
create policy pd_project_deliverables_update
on public.pd_project_deliverables
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
      where p.id = pd_project_deliverables.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor_or_coordenador(project_id, auth.uid())
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
      where p.id = pd_project_deliverables.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor_or_coordenador(project_id, auth.uid())
  )
);

drop policy if exists pd_project_deliverables_delete on public.pd_project_deliverables;
create policy pd_project_deliverables_delete
on public.pd_project_deliverables
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_deliverables.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
);

drop policy if exists pd_project_deliverable_timeline_select on public.pd_project_deliverable_timeline;
create policy pd_project_deliverable_timeline_select
on public.pd_project_deliverable_timeline
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or public.pd_is_project_member(project_id, auth.uid())
  )
);

drop policy if exists pd_project_deliverable_timeline_insert on public.pd_project_deliverable_timeline;
create policy pd_project_deliverable_timeline_insert
on public.pd_project_deliverable_timeline
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or public.pd_is_project_member(project_id, auth.uid())
  )
);

commit;
