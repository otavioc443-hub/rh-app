-- Estrutura inicial para agenda institucional

begin;

create table if not exists public.institutional_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text null,
  event_date date not null,
  visibility text not null default 'all' check (visibility in ('all')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.institutional_events enable row level security;

drop policy if exists institutional_events_select_auth on public.institutional_events;
create policy institutional_events_select_auth
on public.institutional_events
for select
to authenticated
using (true);

drop policy if exists institutional_events_write_rh_admin on public.institutional_events;
create policy institutional_events_write_rh_admin
on public.institutional_events
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('rh', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('rh', 'admin')
  )
);

create index if not exists idx_institutional_events_date
  on public.institutional_events(event_date asc);

commit;
