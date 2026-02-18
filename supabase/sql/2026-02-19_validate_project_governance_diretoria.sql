-- Validacao tecnica: governanca de projetos (Diretoria x Gestor)
-- Script somente leitura.

-- 1) Trigger de restricao de status/etapa existe?
select
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'projects'
  and not t.tgisinternal
  and t.tgname = 'trg_validate_projects_status_stage_update_role';

-- 2) Funcao de validacao existe?
select
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'validate_projects_status_stage_update_role';

-- 3) Policies de projects (insert/update) ativas?
select
  pol.polname as policy_name,
  pol.polcmd as command
from pg_policy pol
join pg_class cls on cls.oid = pol.polrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and cls.relname = 'projects'
  and pol.polname in (
    'projects_insert_gestor_admin_rh',
    'projects_update_owner_admin_rh'
  )
order by pol.polname;

-- 4) Conferencia rapida de distribuicao por owner no cadastro de projetos
select
  p.owner_user_id,
  count(*) as total_projects
from public.projects p
group by p.owner_user_id
order by total_projects desc
limit 30;

