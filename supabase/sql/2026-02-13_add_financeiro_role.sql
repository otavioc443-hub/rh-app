-- Adiciona a role "financeiro" ao portal e adequa policies para leitura/decisão financeira.
-- Execute no Supabase SQL Editor com permissao de owner/admin.

begin;

-- 1) Atualiza current_role(): impede escalacao para admin/rh/financeiro via cargos.portal_role.
create or replace function public.current_role()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_profile_role text;
  v_cargo_role text;
begin
  select p.role
    into v_profile_role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  -- Roles privilegiadas SOMENTE por profiles (evita escalacao via cargo).
  if v_profile_role in ('admin', 'rh', 'financeiro') then
    return v_profile_role;
  end if;

  select cg.portal_role
    into v_cargo_role
  from public.colaboradores c
  join public.cargos cg on lower(trim(cg.name)) = lower(trim(c.cargo))
  where c.user_id = auth.uid()
  limit 1;

  if v_cargo_role in ('admin', 'rh', 'financeiro') then
    v_cargo_role := null;
  end if;

  return coalesce(v_cargo_role, v_profile_role, 'colaborador');
end;
$$;

grant execute on function public.current_role() to authenticated;

-- Mantem compatibilidade: is_rh_or_admin continua significando somente RH/Admin.
create or replace function public.is_rh_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.current_role() in ('rh', 'admin');
$$;

grant execute on function public.is_rh_or_admin() to authenticated;

-- 2) Ajuste de constraint (se existir) para permitir profiles.role = 'financeiro'.
do $$
declare
  v_name text;
begin
  select conname into v_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%'
    and pg_get_constraintdef(oid) ilike '%colaborador%'
  limit 1;

  if v_name is not null then
    execute format('alter table public.profiles drop constraint %I', v_name);
  end if;

  -- Recria uma constraint padrao (idempotente via drop acima).
  alter table public.profiles
    add constraint profiles_role_check
    check (role is null or role in ('colaborador','coordenador','gestor','rh','financeiro','admin'));
exception
  when undefined_table then
    -- Se profiles ainda nao existir neste projeto, ignora.
    null;
  when duplicate_object then
    null;
end $$;

-- 3) Financeiro: leitura de colaboradores (inclui salario) para relatorios.
drop policy if exists colaboradores_select_financeiro on public.colaboradores;
create policy colaboradores_select_financeiro
on public.colaboradores
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('financeiro', 'admin')
      and (
        p.role = 'admin'
        or (
          p.company_id is not null
          and exists (
            select 1
            from public.project_members pm
            join public.projects pr on pr.id = pm.project_id
            where pm.user_id = colaboradores.user_id
              and pr.company_id = p.company_id
          )
        )
      )
  )
);

-- 4) Financeiro: acesso a projetos/dados do projeto (somente leitura) por empresa.
drop policy if exists projects_select_finance_company on public.projects;
create policy projects_select_finance_company
on public.projects
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('financeiro', 'admin')
      and p.company_id is not null
      and p.company_id = projects.company_id
  )
);

drop policy if exists project_members_select_finance_company on public.project_members;
create policy project_members_select_finance_company
on public.project_members
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = project_members.project_id
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('financeiro', 'admin')
      and p.company_id is not null
      and p.company_id = pr.company_id
  )
);

drop policy if exists deliverables_select_finance_company on public.project_deliverables;
create policy deliverables_select_finance_company
on public.project_deliverables
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = project_deliverables.project_id
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('financeiro', 'admin')
      and p.company_id is not null
      and p.company_id = pr.company_id
  )
);

drop policy if exists contributions_select_finance_company on public.deliverable_contributions;
create policy contributions_select_finance_company
on public.deliverable_contributions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.project_deliverables d on d.id = deliverable_contributions.deliverable_id
    join public.projects pr on pr.id = d.project_id
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('financeiro', 'admin')
      and p.company_id is not null
      and p.company_id = pr.company_id
  )
);

-- 5) Financeiro: decidir status de pagamentos extras.
drop policy if exists project_extra_payments_select_finance_company on public.project_extra_payments;
create policy project_extra_payments_select_finance_company
on public.project_extra_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = project_extra_payments.project_id
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('financeiro', 'admin')
      and p.company_id is not null
      and p.company_id = pr.company_id
  )
);

drop policy if exists project_extra_payments_update_finance_company on public.project_extra_payments;
create policy project_extra_payments_update_finance_company
on public.project_extra_payments
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = project_extra_payments.project_id
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('financeiro', 'admin')
      and p.company_id is not null
      and p.company_id = pr.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = project_extra_payments.project_id
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('financeiro', 'admin')
      and p.company_id is not null
      and p.company_id = pr.company_id
  )
);

commit;
