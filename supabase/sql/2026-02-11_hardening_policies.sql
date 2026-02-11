-- Hardening de RLS e policies (aplicado em 2026-02-11)
-- Execute no Supabase SQL Editor com permissao de owner/admin.

begin;

-- =========================================================
-- 1) colaboradores
-- =========================================================
alter table if exists public.colaboradores enable row level security;

drop policy if exists colaboradores_select_rh_admin on public.colaboradores;
create policy colaboradores_select_rh_admin
on public.colaboradores
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('rh', 'admin')
  )
);

drop policy if exists colaboradores_write_rh_admin on public.colaboradores;
create policy colaboradores_write_rh_admin
on public.colaboradores
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

drop policy if exists colaboradores_select_own on public.colaboradores;
create policy colaboradores_select_own
on public.colaboradores
for select
to authenticated
using (user_id = auth.uid());

-- =========================================================
-- 2) companies
-- =========================================================
alter table if exists public.companies enable row level security;

drop policy if exists "allow read companies" on public.companies;
drop policy if exists "debug select companies" on public.companies;
drop policy if exists companies_select_authenticated on public.companies;
drop policy if exists companies_select_admin_all on public.companies;
drop policy if exists companies_select_rh_all on public.companies;
drop policy if exists companies_select_own_company on public.companies;
drop policy if exists companies_admin_write on public.companies;
drop policy if exists companies_select_authenticated_active on public.companies;
drop policy if exists companies_write_admin on public.companies;

create policy companies_select_authenticated_active
on public.companies
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        p.role in ('rh', 'admin')
        or p.company_id = companies.id
      )
  )
);

create policy companies_write_admin
on public.companies
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

-- =========================================================
-- 3) departments
-- =========================================================
alter table if exists public.departments enable row level security;

drop policy if exists "allow read departments" on public.departments;
drop policy if exists departments_select_authenticated on public.departments;
drop policy if exists departments_select_admin_all on public.departments;
drop policy if exists departments_select_own_department on public.departments;
drop policy if exists departments_select_rh_same_company on public.departments;
drop policy if exists departments_admin_write on public.departments;
drop policy if exists "rh_admin_select_departments_same_company" on public.departments;
drop policy if exists departments_select_authenticated_active on public.departments;
drop policy if exists departments_write_admin on public.departments;

create policy departments_select_authenticated_active
on public.departments
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        p.role in ('rh', 'admin')
        or p.company_id = departments.company_id
      )
  )
);

create policy departments_write_admin
on public.departments
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

-- =========================================================
-- 4) Bucket company-logos
-- =========================================================
update storage.buckets
set
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png']
where name = 'company-logos';

commit;
