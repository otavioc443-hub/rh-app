begin;

-- 1) profiles.role: inclui diretoria
do $$
declare
  v_name text;
begin
  select conname
  into v_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%';

  if v_name is not null then
    execute format('alter table public.profiles drop constraint %I', v_name);
  end if;

  alter table public.profiles
    add constraint profiles_role_check
    check (
      role is null
      or role in ('colaborador','coordenador','gestor','diretoria','rh','financeiro','pd','admin','super_admin')
    );
exception
  when undefined_table then
    null;
  when duplicate_object then
    null;
end $$;

-- 2) cargos.portal_role: inclui diretoria
alter table if exists public.cargos
  drop constraint if exists cargos_portal_role_check;

alter table if exists public.cargos
  add constraint cargos_portal_role_check
  check (
    portal_role is null
    or portal_role in ('colaborador', 'coordenador', 'gestor', 'diretoria', 'rh', 'financeiro', 'pd', 'admin', 'super_admin')
  );

commit;

