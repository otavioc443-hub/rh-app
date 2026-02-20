begin;

alter table if exists public.cargos
  drop constraint if exists cargos_portal_role_check;

alter table if exists public.cargos
  add constraint cargos_portal_role_check
  check (
    portal_role is null
    or portal_role in ('colaborador', 'coordenador', 'gestor', 'rh', 'financeiro', 'pd', 'admin', 'super_admin')
  );

commit;

