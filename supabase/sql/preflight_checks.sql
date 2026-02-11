-- Preflight de validacao para ambiente Supabase
-- Execute no SQL Editor como role com privilegio de leitura em catalogo.

-- 1) Auth user x profile (visao geral)
select
  u.id as auth_user_id,
  u.email as auth_email,
  p.id as profile_id,
  p.email as profile_email,
  p.role,
  p.active,
  case
    when p.id is null then 'MISSING_PROFILE'
    when p.id <> u.id then 'ID_MISMATCH'
    when coalesce(lower(p.email), '') <> coalesce(lower(u.email), '') then 'EMAIL_MISMATCH'
    when p.active is distinct from true then 'INACTIVE_PROFILE'
    else 'OK'
  end as status
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc
limit 200;

-- 2) Tabelas criticas e status de RLS
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
  c.table_name,
  coalesce(cl.relrowsecurity, false) as rls_enabled
from critical_tables c
left join pg_class cl on cl.relname = c.table_name
left join pg_namespace ns on ns.oid = cl.relnamespace and ns.nspname = 'public'
order by c.table_name;

-- 3) Policies existentes por tabela critica
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
  c.table_name,
  coalesce(count(p.policyname), 0) as policy_count
from critical_tables c
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = c.table_name
group by c.table_name
order by c.table_name;

-- 4) Detalhe de policies (auditoria manual)
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'companies',
    'departments',
    'colaboradores',
    'absence_allowances',
    'absence_requests'
  )
order by tablename, policyname;

-- 5) Bucket de logos
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where name = 'company-logos';

