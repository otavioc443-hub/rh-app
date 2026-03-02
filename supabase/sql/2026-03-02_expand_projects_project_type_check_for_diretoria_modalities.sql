begin;

alter table if exists public.projects
  drop constraint if exists projects_project_type_check;

alter table if exists public.projects
  add constraint projects_project_type_check
  check (
    project_type is null
    or project_type in (
      'hv',
      'rmt',
      'basico',
      'estrutural',
      'civil',
      'bim',
      'eletromecanico',
      'eletrico',
      'hidraulico',
      'outro',
      'executivo',
      'eng_proprietario',
      'consultoria'
    )
  );

commit;
