-- Corrige recursao infinita de RLS envolvendo policies que consultam public.profiles.
-- Abordagem: mover leituras de role/active/company_id para funcoes security definer (row_security=off),
-- e recriar policies criticas sem subqueries diretas em profiles.
--
-- Execute no Supabase SQL Editor com permissao de owner/admin.

begin;

-- =========================================================
-- 1) Funcoes auxiliares (sem RLS)
-- =========================================================

-- Perfil
create or replace function public.current_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select coalesce(p.active, false)
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select p.company_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

-- Projetos / membership (prefixo rls_ para evitar conflito com funcoes existentes)
create or replace function public.rls_project_company_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select pr.company_id
  from public.projects pr
  where pr.id = p_project_id
  limit 1;
$$;

create or replace function public.rls_is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function public.rls_deliverable_project_id(p_deliverable_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select d.project_id
  from public.project_deliverables d
  where d.id = p_deliverable_id
  limit 1;
$$;

create or replace function public.rls_user_has_project_in_company(p_user_id uuid, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.projects pr on pr.id = pm.project_id
    where pm.user_id = p_user_id
      and pr.company_id = p_company_id
  );
$$;

grant execute on function public.current_active() to authenticated;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.rls_project_company_id(uuid) to authenticated;
grant execute on function public.rls_is_project_member(uuid) to authenticated;
grant execute on function public.rls_deliverable_project_id(uuid) to authenticated;
grant execute on function public.rls_user_has_project_in_company(uuid, uuid) to authenticated;

-- =========================================================
-- 2) projects (SELECT)
-- =========================================================

drop policy if exists projects_select_member on public.projects;
drop policy if exists projects_select_finance_company on public.projects;

create policy projects_select_member
on public.projects
for select
to authenticated
using (
  public.rls_is_project_member(projects.id)
  or (
    public.current_active()
    and public.current_role() in ('admin', 'rh')
  )
);

create policy projects_select_finance_company
on public.projects
for select
to authenticated
using (
  public.current_active()
  and public.current_role() in ('financeiro', 'admin')
  and (
    public.current_role() = 'admin'
    or (public.current_company_id() is not null and public.current_company_id() = projects.company_id)
  )
);

-- =========================================================
-- 3) project_members (SELECT)
-- =========================================================

drop policy if exists project_members_select_project_member on public.project_members;
drop policy if exists project_members_select_finance_company on public.project_members;

create policy project_members_select_project_member
on public.project_members
for select
to authenticated
using (
  public.rls_is_project_member(project_members.project_id)
  or (
    public.current_active()
    and public.current_role() in ('admin', 'rh')
  )
);

create policy project_members_select_finance_company
on public.project_members
for select
to authenticated
using (
  public.current_active()
  and public.current_role() in ('financeiro', 'admin')
  and (
    public.current_role() = 'admin'
    or (
      public.current_company_id() is not null
      and public.rls_project_company_id(project_members.project_id) = public.current_company_id()
    )
  )
);

-- =========================================================
-- 4) project_deliverables (SELECT)
-- =========================================================

drop policy if exists deliverables_select_project_member on public.project_deliverables;
drop policy if exists deliverables_select_finance_company on public.project_deliverables;

create policy deliverables_select_project_member
on public.project_deliverables
for select
to authenticated
using (
  public.rls_is_project_member(project_deliverables.project_id)
  or (
    public.current_active()
    and public.current_role() in ('admin', 'rh')
  )
);

create policy deliverables_select_finance_company
on public.project_deliverables
for select
to authenticated
using (
  public.current_active()
  and public.current_role() in ('financeiro', 'admin')
  and (
    public.current_role() = 'admin'
    or (
      public.current_company_id() is not null
      and public.rls_project_company_id(project_deliverables.project_id) = public.current_company_id()
    )
  )
);

-- =========================================================
-- 5) deliverable_contributions (SELECT)
-- =========================================================

drop policy if exists contributions_select_project_member on public.deliverable_contributions;
drop policy if exists contributions_select_finance_company on public.deliverable_contributions;

create policy contributions_select_project_member
on public.deliverable_contributions
for select
to authenticated
using (
  public.rls_is_project_member(public.rls_deliverable_project_id(deliverable_contributions.deliverable_id))
  or (
    public.current_active()
    and public.current_role() in ('admin', 'rh')
  )
);

create policy contributions_select_finance_company
on public.deliverable_contributions
for select
to authenticated
using (
  public.current_active()
  and public.current_role() in ('financeiro', 'admin')
  and (
    public.current_role() = 'admin'
    or (
      public.current_company_id() is not null
      and public.rls_project_company_id(public.rls_deliverable_project_id(deliverable_contributions.deliverable_id)) = public.current_company_id()
    )
  )
);

-- =========================================================
-- 6) project_extra_payments (SELECT/UPDATE) para financeiro
-- =========================================================

drop policy if exists project_extra_payments_select_finance_company on public.project_extra_payments;
drop policy if exists project_extra_payments_update_finance_company on public.project_extra_payments;

create policy project_extra_payments_select_finance_company
on public.project_extra_payments
for select
to authenticated
using (
  public.current_active()
  and public.current_role() in ('financeiro', 'admin')
  and (
    public.current_role() = 'admin'
    or (
      public.current_company_id() is not null
      and public.rls_project_company_id(project_extra_payments.project_id) = public.current_company_id()
    )
  )
);

create policy project_extra_payments_update_finance_company
on public.project_extra_payments
for update
to authenticated
using (
  public.current_active()
  and public.current_role() in ('financeiro', 'admin')
  and (
    public.current_role() = 'admin'
    or (
      public.current_company_id() is not null
      and public.rls_project_company_id(project_extra_payments.project_id) = public.current_company_id()
    )
  )
)
with check (
  public.current_active()
  and public.current_role() in ('financeiro', 'admin')
  and (
    public.current_role() = 'admin'
    or (
      public.current_company_id() is not null
      and public.rls_project_company_id(project_extra_payments.project_id) = public.current_company_id()
    )
  )
);

-- =========================================================
-- 7) colaboradores (SELECT) para financeiro sem depender de colaboradores.company_id
-- =========================================================

drop policy if exists colaboradores_select_financeiro on public.colaboradores;

create policy colaboradores_select_financeiro
on public.colaboradores
for select
to authenticated
using (
  public.current_active()
  and public.current_role() in ('financeiro', 'admin')
  and (
    public.current_role() = 'admin'
    or (
      public.current_company_id() is not null
      and public.rls_user_has_project_in_company(colaboradores.user_id, public.current_company_id())
    )
  )
);

commit;
