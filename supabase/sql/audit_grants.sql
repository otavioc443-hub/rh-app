-- Auditoria de grants (privilegios) em tabelas e schemas relevantes.
-- Nao altera nada: somente leitura.

-- 1) Grants por tabela critica
with critical_tables as (
  select unnest(array[
    'profiles',
    'companies',
    'departments',
    'colaboradores',
    'absence_allowances',
    'absence_requests'
  ]) as table_name
)
select
  g.table_schema,
  g.table_name,
  g.grantee,
  g.privilege_type,
  g.is_grantable
from information_schema.role_table_grants g
join critical_tables c on c.table_name = g.table_name
where g.table_schema = 'public'
order by g.table_name, g.grantee, g.privilege_type;

-- 2) Grants no schema public
-- Nota: alguns ambientes Supabase/Postgres nao expõem information_schema.schema_privileges.
-- Por isso usamos has_schema_privilege(...), que é portável.
with target_roles as (
  select rolname as grantee
  from pg_roles
  where rolname in ('anon', 'authenticated', 'service_role', 'postgres')
),
privs as (
  select unnest(array['USAGE', 'CREATE']) as privilege_type
)
select
  'public'::text as schema_name,
  r.grantee,
  p.privilege_type
from target_roles r
cross join privs p
where has_schema_privilege(r.grantee, 'public', p.privilege_type)
order by r.grantee, p.privilege_type;

-- 3) Grants no schema storage (visibilidade de buckets/objetos)
with target_roles as (
  select rolname as grantee
  from pg_roles
  where rolname in ('anon', 'authenticated', 'service_role', 'postgres')
),
privs as (
  select unnest(array['USAGE', 'CREATE']) as privilege_type
)
select
  'storage'::text as schema_name,
  r.grantee,
  p.privilege_type
from target_roles r
cross join privs p
where has_schema_privilege(r.grantee, 'storage', p.privilege_type)
order by r.grantee, p.privilege_type;

-- 4) Grants em storage.objects / storage.buckets
select
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'storage'
  and table_name in ('objects', 'buckets')
order by table_name, grantee, privilege_type;
