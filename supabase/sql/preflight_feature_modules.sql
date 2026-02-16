-- Preflight dos modulos funcionais adicionados no portal
-- Verifica existencia de tabelas, RLS e policies.

-- 1) Tabelas esperadas
with expected as (
  select unnest(array[
    'pdi_items',
    'competencias_assessments',
    'performance_assessments',
    'institutional_events',
    'institutional_content',
    'projects',
    'project_members',
    'project_deliverables',
    'deliverable_contributions',
    'project_extra_payments'
  ]) as table_name
)
select
  e.table_name,
  case when c.relname is null then false else true end as table_exists,
  coalesce(c.relrowsecurity, false) as rls_enabled
from expected e
left join pg_class c on c.relname = e.table_name
left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
order by e.table_name;

-- 2) Quantidade de policies por tabela
with expected as (
  select unnest(array[
    'pdi_items',
    'competencias_assessments',
    'performance_assessments',
    'institutional_events',
    'institutional_content',
    'projects',
    'project_members',
    'project_deliverables',
    'deliverable_contributions',
    'project_extra_payments'
  ]) as table_name
)
select
  e.table_name,
  count(p.policyname) as policy_count
from expected e
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = e.table_name
group by e.table_name
order by e.table_name;

-- 3) Detalhe das policies dos modulos
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'pdi_items',
    'competencias_assessments',
    'performance_assessments',
    'institutional_events',
    'institutional_content',
    'projects',
    'project_members',
    'project_deliverables',
    'deliverable_contributions',
    'project_extra_payments'
  )
order by tablename, policyname;
