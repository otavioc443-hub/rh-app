begin;

alter table if exists public.companies enable row level security;
alter table if exists public.departments enable row level security;

-- =========================
-- companies
-- =========================
drop policy if exists companies_select_authenticated_active on public.companies;
drop policy if exists companies_write_admin on public.companies;
drop policy if exists companies_select_tenant on public.companies;
drop policy if exists companies_insert_super_admin on public.companies;
drop policy if exists companies_update_tenant_admin on public.companies;
drop policy if exists companies_delete_super_admin on public.companies;

create policy companies_select_tenant
on public.companies
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'super_admin'
    or (
      public.current_role() in ('admin', 'rh')
      and public.current_company_id() is not null
      and public.current_company_id() = companies.id
    )
  )
);

create policy companies_insert_super_admin
on public.companies
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'super_admin'
);

create policy companies_update_tenant_admin
on public.companies
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'super_admin'
    or (
      public.current_role() = 'admin'
      and public.current_company_id() is not null
      and public.current_company_id() = companies.id
    )
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() = 'super_admin'
    or (
      public.current_role() = 'admin'
      and public.current_company_id() is not null
      and public.current_company_id() = companies.id
    )
  )
);

create policy companies_delete_super_admin
on public.companies
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'super_admin'
);

-- =========================
-- departments
-- =========================
drop policy if exists departments_select_authenticated_active on public.departments;
drop policy if exists departments_write_admin on public.departments;
drop policy if exists departments_select_tenant on public.departments;
drop policy if exists departments_insert_tenant_admin on public.departments;
drop policy if exists departments_update_tenant_admin on public.departments;
drop policy if exists departments_delete_tenant_admin on public.departments;

create policy departments_select_tenant
on public.departments
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'super_admin'
    or (
      public.current_role() in ('admin', 'rh')
      and public.current_company_id() is not null
      and public.current_company_id() = departments.company_id
    )
  )
);

create policy departments_insert_tenant_admin
on public.departments
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'super_admin'
    or (
      public.current_role() in ('admin', 'rh')
      and public.current_company_id() is not null
      and public.current_company_id() = departments.company_id
    )
  )
);

create policy departments_update_tenant_admin
on public.departments
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'super_admin'
    or (
      public.current_role() in ('admin', 'rh')
      and public.current_company_id() is not null
      and public.current_company_id() = departments.company_id
    )
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() = 'super_admin'
    or (
      public.current_role() in ('admin', 'rh')
      and public.current_company_id() is not null
      and public.current_company_id() = departments.company_id
    )
  )
);

create policy departments_delete_tenant_admin
on public.departments
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'super_admin'
    or (
      public.current_role() in ('admin', 'rh')
      and public.current_company_id() is not null
      and public.current_company_id() = departments.company_id
    )
  )
);

commit;

