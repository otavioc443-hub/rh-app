begin;

-- Etapa executiva para diretoria: Ofertas -> Desenvolvimento -> As Built.
alter table if exists public.projects
  add column if not exists project_stage text null;

alter table if exists public.projects
  drop constraint if exists ck_projects_project_stage;

alter table if exists public.projects
  add constraint ck_projects_project_stage
  check (project_stage in ('ofertas', 'desenvolvimento', 'as_built'));

-- Backfill a partir do status tecnico atual.
update public.projects
set project_stage = case
  when status = 'paused' then 'ofertas'
  when status = 'active' then 'desenvolvimento'
  when status = 'done' then 'as_built'
  else 'desenvolvimento'
end
where project_stage is null;

-- Garante default para novos projetos.
alter table if exists public.projects
  alter column project_stage set default 'ofertas';

commit;
