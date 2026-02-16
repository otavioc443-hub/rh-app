begin;

-- Historico de absenteismo por colaborador (faltas, atestados, licencas e outros).
create table if not exists public.collaborator_absence_events (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.colaboradores(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,

  event_type text not null check (event_type in ('falta', 'atestado', 'licenca', 'outro')),
  start_date date not null,
  end_date date null,
  days_count integer not null default 1 check (days_count > 0),

  has_certificate boolean not null default false,
  certificate_date date null,
  cid text null,
  notes text null,

  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collab_absence_events_collab_date
  on public.collaborator_absence_events(collaborator_id, start_date desc, created_at desc);

drop trigger if exists trg_collab_absence_events_updated_at on public.collaborator_absence_events;
create trigger trg_collab_absence_events_updated_at
before update on public.collaborator_absence_events
for each row execute function public.set_updated_at();

alter table public.collaborator_absence_events enable row level security;

-- Leitura: RH/Admin/Financeiro ou proprio colaborador dono do registro.
drop policy if exists collab_absence_events_select on public.collaborator_absence_events;
create policy collab_absence_events_select
on public.collaborator_absence_events
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro')
    or user_id = auth.uid()
  )
);

-- Escrita: RH/Admin.
drop policy if exists collab_absence_events_insert on public.collaborator_absence_events;
create policy collab_absence_events_insert
on public.collaborator_absence_events
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh')
);

drop policy if exists collab_absence_events_update on public.collaborator_absence_events;
create policy collab_absence_events_update
on public.collaborator_absence_events
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh')
)
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh')
);

drop policy if exists collab_absence_events_delete on public.collaborator_absence_events;
create policy collab_absence_events_delete
on public.collaborator_absence_events
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh')
);

commit;

