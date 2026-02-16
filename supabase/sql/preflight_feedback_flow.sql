-- Preflight do fluxo de feedback (coordenador/gestor/rh).
-- Execute no SQL Editor para validar estrutura e dados minimos.

-- 1) Tabela de ciclos + status de RLS
select
  c.relname as table_name,
  coalesce(c.relrowsecurity, false) as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('feedback_cycles', 'feedbacks')
order by c.relname;

-- 2) Policies das tabelas de feedback
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
  and tablename in ('feedback_cycles', 'feedbacks')
order by tablename, policyname;

-- 3) Ciclo ativo e janelas
select
  id,
  name,
  collect_start,
  collect_end,
  release_start,
  release_end,
  active,
  created_at
from public.feedback_cycles
order by created_at desc
limit 5;

-- 4) Perfis com dados-chave para fluxo hierarquico
select
  id,
  email,
  full_name,
  role,
  active,
  manager_id,
  company_id,
  department_id
from public.profiles
where role in ('gestor', 'coordenador', 'colaborador', 'rh', 'admin')
order by role, full_name nulls last, email nulls last
limit 500;

-- 5) Feedbacks recentes
select
  id,
  created_at,
  target_user_id,
  evaluator_user_id,
  source_role,
  status,
  final_score,
  final_classification,
  released_to_collaborator,
  cycle_id
from public.feedbacks
order by created_at desc
limit 100;
