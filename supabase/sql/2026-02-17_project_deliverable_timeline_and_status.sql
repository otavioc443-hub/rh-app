begin;

-- Novo status com comentarios e campo de comentario da aprovacao.
alter table if exists public.project_deliverables
  add column if not exists approval_comment text null;

alter table if exists public.project_deliverables
  drop constraint if exists project_deliverables_status_check;

alter table if exists public.project_deliverables
  drop constraint if exists ck_project_deliverables_status;

alter table if exists public.project_deliverables
  add constraint ck_project_deliverables_status
  check (
    status in ('pending', 'in_progress', 'sent', 'approved', 'approved_with_comments')
  );

-- Timeline por entregavel.
create table if not exists public.project_deliverable_timeline (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.project_deliverables(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  event_type text not null,
  status_from text null,
  status_to text null,
  comment text null,
  metadata jsonb null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_deliverable_timeline_deliverable
  on public.project_deliverable_timeline(deliverable_id, created_at desc);

create index if not exists idx_project_deliverable_timeline_project
  on public.project_deliverable_timeline(project_id, created_at desc);

alter table public.project_deliverable_timeline enable row level security;

-- Leitura: membros do projeto + admin/rh/financeiro.
drop policy if exists project_deliverable_timeline_select on public.project_deliverable_timeline;
create policy project_deliverable_timeline_select
on public.project_deliverable_timeline
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_deliverable_timeline.project_id
        and pm.user_id = auth.uid()
    )
  )
);

-- Escrita: membros do projeto + admin/rh/financeiro (log operacional).
drop policy if exists project_deliverable_timeline_insert on public.project_deliverable_timeline;
create policy project_deliverable_timeline_insert
on public.project_deliverable_timeline
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_deliverable_timeline.project_id
        and pm.user_id = auth.uid()
    )
  )
);

commit;

