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
select
  grantee,
  privilege_type
from information_schema.schema_privileges
where schema_name = 'public'
order by grantee, privilege_type;

-- 3) Grants no schema storage (visibilidade de buckets/objetos)
select
  grantee,
  privilege_type
from information_schema.schema_privileges
where schema_name = 'storage'
order by grantee, privilege_type;

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
