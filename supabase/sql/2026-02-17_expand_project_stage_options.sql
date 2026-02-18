begin;

-- Expande opcoes de fase executiva para diretoria.
alter table if exists public.projects
  drop constraint if exists ck_projects_project_stage;

alter table if exists public.projects
  add constraint ck_projects_project_stage
  check (project_stage in ('ofertas', 'desenvolvimento', 'as_built', 'pausado', 'cancelado'));

commit;
