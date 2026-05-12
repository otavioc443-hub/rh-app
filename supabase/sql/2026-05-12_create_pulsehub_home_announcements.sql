begin;

create table if not exists public.pulsehub_home_announcements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  label text not null default 'Comunicado',
  title text not null,
  body text not null,
  cta_label text not null default 'Ver comunicados',
  cta_href text not null default '/institucional/rede-social',
  display_order integer not null default 0,
  active boolean not null default true,
  starts_at timestamptz null,
  ends_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pulsehub_home_announcements_visible
  on public.pulsehub_home_announcements(company_id, active, display_order, created_at desc);

drop trigger if exists trg_pulsehub_home_announcements_updated_at on public.pulsehub_home_announcements;
create trigger trg_pulsehub_home_announcements_updated_at
before update on public.pulsehub_home_announcements
for each row execute function public.set_updated_at();

alter table public.pulsehub_home_announcements enable row level security;

drop policy if exists pulsehub_home_announcements_select on public.pulsehub_home_announcements;
create policy pulsehub_home_announcements_select
on public.pulsehub_home_announcements
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        p.role = 'admin'
        or (
          pulsehub_home_announcements.active = true
          and (pulsehub_home_announcements.starts_at is null or pulsehub_home_announcements.starts_at <= now())
          and (pulsehub_home_announcements.ends_at is null or pulsehub_home_announcements.ends_at >= now())
          and (
            pulsehub_home_announcements.company_id is null
            or pulsehub_home_announcements.company_id = p.company_id
          )
        )
      )
  )
);

drop policy if exists pulsehub_home_announcements_write_admin on public.pulsehub_home_announcements;
create policy pulsehub_home_announcements_write_admin
on public.pulsehub_home_announcements
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role = 'admin'
  )
);

commit;
