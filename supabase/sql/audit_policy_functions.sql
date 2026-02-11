-- Auditoria de funcoes usadas em policies
-- Objetivo: validar security definer e search_path fixo.

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  coalesce(p.proconfig::text, '{}') as proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_rh_or_admin', 'current_role')
order by p.proname, args;

-- Policies que referenciam essas funcoes (checagem rapida)
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    coalesce(qual, '') ilike '%is_rh_or_admin(%'
    or coalesce(qual, '') ilike '%current_role(%'
    or coalesce(with_check, '') ilike '%is_rh_or_admin(%'
    or coalesce(with_check, '') ilike '%current_role(%'
  )
order by tablename, policyname;
