begin;

-- 1) Migra perfis antigos de super_admin para admin.
update public.profiles
set role = 'admin'
where role = 'super_admin';

-- 2) Remove super_admin das constraints de role.
alter table if exists public.profiles
  drop constraint if exists profiles_role_check;

alter table if exists public.profiles
  add constraint profiles_role_check
  check (
    role is null
    or role in ('colaborador','coordenador','gestor','diretoria','rh','financeiro','pd','admin')
  );

alter table if exists public.cargos
  drop constraint if exists cargos_portal_role_check;

alter table if exists public.cargos
  add constraint cargos_portal_role_check
  check (
    portal_role is null
    or portal_role in ('colaborador','coordenador','gestor','diretoria','rh','financeiro','pd','admin')
  );

-- 3) current_role sem super_admin.
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

-- Compatibilidade: chamada antiga passa a retornar falso.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select false;
$$;

grant execute on function public.is_super_admin() to authenticated;

-- 4) Admin pode alterar role e vincular empresa sem bloqueio por company_id atual.
create or replace function public.block_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.role is not distinct from old.role then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if public.current_role() = 'admin' then
    return new;
  end if;

  raise exception 'Somente admin pode alterar role';
end;
$$;

create or replace function public.bind_profile_to_company(
  p_user_id uuid,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_company_id is null then
    raise exception 'p_user_id e p_company_id sao obrigatorios';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'usuario nao encontrado';
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    raise exception 'empresa nao encontrada';
  end if;

  if auth.uid() is not null and public.current_role() <> 'admin' then
    raise exception 'sem permissao';
  end if;

  insert into public.profiles (id, company_id, active)
  values (p_user_id, p_company_id, true)
  on conflict (id)
  do update set
    company_id = excluded.company_id,
    active = true;
end;
$$;

grant execute on function public.bind_profile_to_company(uuid, uuid) to authenticated;

-- 5) Relaxa escopo admin para empresas/departamentos (sem restricao de company_id do ator).
alter table if exists public.companies enable row level security;
alter table if exists public.departments enable row level security;

drop policy if exists companies_select_tenant on public.companies;
drop policy if exists companies_insert_super_admin on public.companies;
drop policy if exists companies_update_tenant_admin on public.companies;
drop policy if exists companies_delete_super_admin on public.companies;

create policy companies_select_admin_rh
on public.companies
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin','rh')
);

create policy companies_insert_admin
on public.companies
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

create policy companies_update_admin
on public.companies
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
)
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

create policy companies_delete_admin
on public.companies
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists departments_select_tenant on public.departments;
drop policy if exists departments_insert_tenant_admin on public.departments;
drop policy if exists departments_update_tenant_admin on public.departments;
drop policy if exists departments_delete_tenant_admin on public.departments;

create policy departments_select_admin_rh
on public.departments
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin','rh')
);

create policy departments_insert_admin_rh
on public.departments
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin','rh')
);

create policy departments_update_admin_rh
on public.departments
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin','rh')
)
with check (
  public.current_active() = true
  and public.current_role() in ('admin','rh')
);

create policy departments_delete_admin_rh
on public.departments
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin','rh')
);

-- 6) Limpeza de historico por admin sem ramo super_admin.
create or replace function public.clear_project_deliverable_history(
  p_project_id uuid default null,
  p_deliverable_id uuid default null,
  p_reset_submission_fields boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deliverable_ids uuid[];
  v_timeline_deleted integer := 0;
  v_contributions_deleted integer := 0;
  v_files_deleted integer := 0;
  v_deliverables_updated integer := 0;
begin
  if public.current_active() is distinct from true then
    raise exception 'usuario inativo';
  end if;

  if public.current_role() <> 'admin' then
    raise exception 'sem permissao para limpar historico de entregaveis';
  end if;

  if p_project_id is null and p_deliverable_id is null then
    raise exception 'informe p_project_id ou p_deliverable_id';
  end if;

  select array_agg(d.id)
  into v_deliverable_ids
  from public.project_deliverables d
  where
    (p_project_id is null or d.project_id = p_project_id)
    and (p_deliverable_id is null or d.id = p_deliverable_id);

  if coalesce(array_length(v_deliverable_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'ok', true,
      'message', 'nenhum entregavel encontrado para o filtro informado',
      'timeline_deleted', 0,
      'contributions_deleted', 0,
      'files_deleted', 0,
      'deliverables_updated', 0
    );
  end if;

  delete from public.project_deliverable_timeline
  where deliverable_id = any(v_deliverable_ids);
  get diagnostics v_timeline_deleted = row_count;

  delete from public.deliverable_contributions
  where deliverable_id = any(v_deliverable_ids);
  get diagnostics v_contributions_deleted = row_count;

  delete from public.project_deliverable_files
  where deliverable_id = any(v_deliverable_ids);
  get diagnostics v_files_deleted = row_count;

  if p_reset_submission_fields then
    update public.project_deliverables
    set
      submitted_by = null,
      submitted_at = null,
      approval_comment = null
    where id = any(v_deliverable_ids);
    get diagnostics v_deliverables_updated = row_count;
  end if;

  return jsonb_build_object(
    'ok', true,
    'timeline_deleted', v_timeline_deleted,
    'contributions_deleted', v_contributions_deleted,
    'files_deleted', v_files_deleted,
    'deliverables_updated', v_deliverables_updated
  );
end;
$$;

grant execute on function public.clear_project_deliverable_history(uuid, uuid, boolean) to authenticated;

-- 7) clear_company_project_data passa a ser admin.
create or replace function public.clear_company_project_data(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_ids uuid[];
  v_projects_deleted integer := 0;
  v_deliverable_files_deleted integer := 0;
begin
  if public.current_role() <> 'admin' then
    raise exception 'sem permissao';
  end if;

  if p_company_id is null then
    raise exception 'p_company_id obrigatorio';
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    raise exception 'empresa nao encontrada';
  end if;

  select array_agg(p.id)
  into v_project_ids
  from public.projects p
  where p.company_id = p_company_id;

  if coalesce(array_length(v_project_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'ok', true,
      'projects_deleted', 0,
      'deliverable_files_deleted', 0,
      'message', 'nenhum projeto encontrado para a empresa'
    );
  end if;

  delete from public.project_deliverable_files f
  where exists (
    select 1
    from public.project_deliverables d
    where d.id = f.deliverable_id
      and d.project_id = any(v_project_ids)
  );
  get diagnostics v_deliverable_files_deleted = row_count;

  delete from public.projects p
  where p.id = any(v_project_ids);
  get diagnostics v_projects_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'projects_deleted', v_projects_deleted,
    'deliverable_files_deleted', v_deliverable_files_deleted
  );
end;
$$;

grant execute on function public.clear_company_project_data(uuid) to authenticated;

-- 8) Auditoria de limpeza sem super_admin.
alter table if exists public.data_cleanup_audit
  drop constraint if exists data_cleanup_audit_actor_role_check;

alter table if exists public.data_cleanup_audit
  add constraint data_cleanup_audit_actor_role_check
  check (actor_role in ('colaborador', 'coordenador', 'gestor', 'rh', 'financeiro', 'pd', 'admin', 'diretoria'));

drop policy if exists data_cleanup_audit_select on public.data_cleanup_audit;
create policy data_cleanup_audit_select
on public.data_cleanup_audit
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists data_cleanup_audit_insert on public.data_cleanup_audit;
create policy data_cleanup_audit_insert
on public.data_cleanup_audit
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;
