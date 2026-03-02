begin;

alter table if exists public.projects
  add column if not exists project_line text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_projects_project_line'
  ) then
    alter table public.projects
      add constraint ck_projects_project_line
      check (project_line is null or project_line in ('eolica', 'solar', 'bess'));
  end if;
end $$;

commit;
