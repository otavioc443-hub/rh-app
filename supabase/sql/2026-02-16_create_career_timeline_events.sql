begin;

-- Historico de trajetoria contratual do colaborador (promocoes, mudancas, etc.).
create table if not exists public.career_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  event_date date not null,
  event_type text not null check (
    event_type in (
      'admission',
      'promotion',
      'role_change',
      'department_change',
      'contract_change',
      'contract_renewal',
      'termination',
      'other'
    )
  ),

  title text not null,
  description text null,

  from_cargo text null,
  to_cargo text null,
  from_department text null,
  to_department text null,
  from_contract_type text null,
  to_contract_type text null,

  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_career_timeline_events_user_date
  on public.career_timeline_events(user_id, event_date desc, created_at desc);

drop trigger if exists trg_career_timeline_events_updated_at on public.career_timeline_events;
create trigger trg_career_timeline_events_updated_at
before update on public.career_timeline_events
for each row execute function public.set_updated_at();

alter table public.career_timeline_events enable row level security;

-- Leitura: proprio usuario, ou admin/rh/financeiro.
drop policy if exists career_timeline_events_select on public.career_timeline_events;
create policy career_timeline_events_select
on public.career_timeline_events
for select
to authenticated
using (
  public.current_active() = true
  and (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro')
  )
);

-- Escrita: apenas RH/Admin.
drop policy if exists career_timeline_events_insert on public.career_timeline_events;
create policy career_timeline_events_insert
on public.career_timeline_events
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh')
);

drop policy if exists career_timeline_events_update on public.career_timeline_events;
create policy career_timeline_events_update
on public.career_timeline_events
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

drop policy if exists career_timeline_events_delete on public.career_timeline_events;
create policy career_timeline_events_delete
on public.career_timeline_events
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh')
);

commit;

