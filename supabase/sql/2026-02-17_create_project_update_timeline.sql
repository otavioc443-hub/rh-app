begin;

-- Timeline de atualizacoes de projeto (status, etapa e ajustes administrativos).
create table if not exists public.project_update_timeline (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text null,
  metadata jsonb null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_update_timeline_project
  on public.project_update_timeline(project_id, created_at desc);

create index if not exists idx_project_update_timeline_event
  on public.project_update_timeline(event_type, created_at desc);

alter table public.project_update_timeline enable row level security;

drop policy if exists project_update_timeline_select on public.project_update_timeline;
create policy project_update_timeline_select
on public.project_update_timeline
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_update_timeline.project_id
        and pm.user_id = auth.uid()
    )
  )
);

drop policy if exists project_update_timeline_insert on public.project_update_timeline;
create policy project_update_timeline_insert
on public.project_update_timeline
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_update_timeline.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_update_timeline.project_id
        and pm.user_id = auth.uid()
        and pm.member_role in ('gestor', 'coordenador')
    )
  )
);

commit;
