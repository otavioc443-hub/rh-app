begin;

-- 1) Permite role super_admin em profiles.
do $$
declare
  v_name text;
begin
  select conname
  into v_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%'
  order by conname
  limit 1;

  if v_name is not null then
    execute format('alter table public.profiles drop constraint %I', v_name);
  end if;

  alter table public.profiles
    add constraint profiles_role_check
    check (
      role is null
      or role in ('colaborador','coordenador','gestor','rh','financeiro','pd','admin','super_admin')
    );
exception
  when undefined_table then
    null;
  when duplicate_object then
    null;
end $$;

-- 2) current_role com suporte a super_admin e sem escalacao por cargo.
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
  if v_profile_role in ('super_admin', 'admin', 'rh', 'financeiro') then
    return v_profile_role;
  end if;

  select cg.portal_role
    into v_cargo_role
  from public.colaboradores c
  join public.cargos cg on lower(trim(cg.name)) = lower(trim(c.cargo))
  where c.user_id = auth.uid()
  limit 1;

  if v_cargo_role in ('super_admin', 'admin', 'rh', 'financeiro') then
    v_cargo_role := null;
  end if;

  return coalesce(v_cargo_role, v_profile_role, 'colaborador');
end;
$$;

grant execute on function public.current_role() to authenticated;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.current_active() = true and public.current_role() = 'super_admin';
$$;

grant execute on function public.is_super_admin() to authenticated;

-- 3) Onboarding: super_admin cria empresa e define admin do tenant.
create or replace function public.create_company_and_tenant_admin(
  p_company_name text,
  p_admin_user_id uuid,
  p_primary_color text default '#111827',
  p_logo_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if public.is_super_admin() is distinct from true then
    raise exception 'sem permissao';
  end if;

  if p_company_name is null or btrim(p_company_name) = '' then
    raise exception 'nome da empresa e obrigatorio';
  end if;

  if p_admin_user_id is null then
    raise exception 'usuario admin e obrigatorio';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_admin_user_id) then
    raise exception 'usuario admin nao encontrado';
  end if;

  insert into public.companies (name, primary_color, logo_url)
  values (btrim(p_company_name), coalesce(nullif(btrim(p_primary_color), ''), '#111827'), nullif(btrim(p_logo_url), ''))
  returning id into v_company_id;

  insert into public.profiles (id, role, active, company_id)
  values (p_admin_user_id, 'admin', true, v_company_id)
  on conflict (id)
  do update set
    role = 'admin',
    active = true,
    company_id = v_company_id;

  return v_company_id;
end;
$$;

grant execute on function public.create_company_and_tenant_admin(text, uuid, text, text) to authenticated;

create or replace function public.assign_tenant_admin(
  p_company_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() is distinct from true then
    raise exception 'sem permissao';
  end if;

  if p_company_id is null or p_user_id is null then
    raise exception 'parametros obrigatorios';
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    raise exception 'empresa nao encontrada';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'usuario nao encontrado';
  end if;

  insert into public.profiles (id, role, active, company_id)
  values (p_user_id, 'admin', true, p_company_id)
  on conflict (id)
  do update set
    role = 'admin',
    active = true,
    company_id = p_company_id;
end;
$$;

grant execute on function public.assign_tenant_admin(uuid, uuid) to authenticated;

-- 4) Isolamento por empresa no modulo de projetos (exceto super_admin).

drop policy if exists projects_select_member on public.projects;
create policy projects_select_member
on public.projects
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = projects.id
      and pm.user_id = auth.uid()
  )
  or (
    public.current_active() = true
    and public.current_role() = 'super_admin'
  )
  or (
    public.current_active() = true
    and public.current_role() in ('admin', 'rh', 'financeiro')
    and public.current_company_id() is not null
    and public.current_company_id() = projects.company_id
  )
);

drop policy if exists projects_insert_gestor_admin_rh on public.projects;
create policy projects_insert_gestor_admin_rh
on public.projects
for insert
to authenticated
with check (
  (
    owner_user_id = auth.uid()
    and public.current_active() = true
    and public.current_role() = 'gestor'
  )
  or (
    public.current_active() = true
    and (
      public.current_role() = 'super_admin'
      or (
        public.current_role() in ('admin', 'rh')
        and public.current_company_id() is not null
        and public.current_company_id() = projects.company_id
      )
    )
  )
);

drop policy if exists projects_update_owner_admin_rh on public.projects;
create policy projects_update_owner_admin_rh
on public.projects
for update
to authenticated
using (
  owner_user_id = auth.uid()
  or (
    public.current_active() = true
    and (
      public.current_role() = 'super_admin'
      or (
        public.current_role() in ('admin', 'rh')
        and public.current_company_id() is not null
        and public.current_company_id() = projects.company_id
      )
    )
  )
)
with check (
  owner_user_id = auth.uid()
  or (
    public.current_active() = true
    and (
      public.current_role() = 'super_admin'
      or (
        public.current_role() in ('admin', 'rh')
        and public.current_company_id() is not null
        and public.current_company_id() = projects.company_id
      )
    )
  )
);

drop policy if exists project_members_select_project_member on public.project_members;
create policy project_members_select_project_member
on public.project_members
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_members.project_id
      and pm.user_id = auth.uid()
  )
  or (
    public.current_active() = true
    and public.current_role() = 'super_admin'
  )
  or (
    public.current_active() = true
    and public.current_role() in ('admin', 'rh', 'financeiro')
    and public.current_company_id() is not null
    and public.rls_project_company_id(project_members.project_id) = public.current_company_id()
  )
);

drop policy if exists deliverables_select_project_member on public.project_deliverables;
create policy deliverables_select_project_member
on public.project_deliverables
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_deliverables.project_id
      and pm.user_id = auth.uid()
  )
  or (
    public.current_active() = true
    and public.current_role() = 'super_admin'
  )
  or (
    public.current_active() = true
    and public.current_role() in ('admin', 'rh', 'financeiro')
    and public.current_company_id() is not null
    and public.rls_project_company_id(project_deliverables.project_id) = public.current_company_id()
  )
);

drop policy if exists contributions_select_project_member on public.deliverable_contributions;
create policy contributions_select_project_member
on public.deliverable_contributions
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    join public.project_deliverables d on d.project_id = pm.project_id
    where pm.user_id = auth.uid()
      and d.id = deliverable_contributions.deliverable_id
  )
  or (
    public.current_active() = true
    and public.current_role() = 'super_admin'
  )
  or (
    public.current_active() = true
    and public.current_role() in ('admin', 'rh', 'financeiro')
    and public.current_company_id() is not null
    and public.rls_project_company_id(public.rls_deliverable_project_id(deliverable_contributions.deliverable_id)) = public.current_company_id()
  )
);

-- 5) Limpeza de dados por empresa (somente super_admin).
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
  if public.is_super_admin() is distinct from true then
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

commit;

