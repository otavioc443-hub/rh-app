begin;

create table if not exists public.project_measurement_bulletin_history (
  id uuid primary key default gen_random_uuid(),
  bulletin_id uuid not null references public.project_measurement_bulletins(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  action text not null check (action in ('created','status_updated','payment_tracking_updated')),
  actor_user_id uuid null references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_measurement_bulletin_history_bulletin_created
  on public.project_measurement_bulletin_history(bulletin_id, created_at desc);

alter table public.project_measurement_bulletin_history enable row level security;

drop policy if exists project_measurement_bulletin_history_select on public.project_measurement_bulletin_history;
create policy project_measurement_bulletin_history_select
on public.project_measurement_bulletin_history
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'financeiro', 'rh', 'diretoria')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_measurement_bulletin_history.project_id
        and pm.user_id = auth.uid()
    )
  )
);

drop policy if exists project_measurement_bulletin_history_insert on public.project_measurement_bulletin_history;
create policy project_measurement_bulletin_history_insert
on public.project_measurement_bulletin_history
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro', 'diretoria')
);

commit;
