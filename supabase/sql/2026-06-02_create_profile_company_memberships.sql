create table if not exists public.profile_company_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  primary key (user_id, company_id)
);

alter table public.profile_company_memberships enable row level security;

drop policy if exists "profile_company_memberships_select_own_or_admin" on public.profile_company_memberships;
create policy "profile_company_memberships_select_own_or_admin"
on public.profile_company_memberships
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
);

drop policy if exists "profile_company_memberships_admin_manage" on public.profile_company_memberships;
create policy "profile_company_memberships_admin_manage"
on public.profile_company_memberships
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
);

create index if not exists idx_profile_company_memberships_company
on public.profile_company_memberships(company_id);
