begin;

-- Corrige recursao infinita em RLS de project_members.
-- Causa: policy consultando a propria tabela via subquery direta.

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

grant execute on function public.rls_is_project_member(uuid) to authenticated;

drop policy if exists project_members_select_project_member on public.project_members;
drop policy if exists project_members_select_finance_company on public.project_members;

create policy project_members_select_project_member
on public.project_members
for select
to authenticated
using (
  public.rls_is_project_member(project_members.project_id)
  or (
    public.current_active() = true
    and public.current_role() in ('admin', 'rh')
  )
);

create policy project_members_select_finance_company
on public.project_members
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('financeiro', 'admin')
  and (
    public.current_role() = 'admin'
    or (
      public.current_company_id() is not null
      and public.rls_project_company_id(project_members.project_id) = public.current_company_id()
    )
  )
);

commit;
