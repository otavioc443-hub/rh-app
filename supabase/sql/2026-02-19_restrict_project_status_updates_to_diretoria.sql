begin;

create or replace function public.validate_projects_status_stage_update_role()
returns trigger
language plpgsql
as $$
declare
  v_role text;
  v_status_old text;
  v_status_new text;
  v_stage_old text;
  v_stage_new text;
begin
  v_status_old := to_jsonb(old)->>'status';
  v_status_new := to_jsonb(new)->>'status';
  v_stage_old := to_jsonb(old)->>'project_stage';
  v_stage_new := to_jsonb(new)->>'project_stage';

  if coalesce(v_status_old, '') is distinct from coalesce(v_status_new, '')
     or coalesce(v_stage_old, '') is distinct from coalesce(v_stage_new, '')
  then
    v_role := public.current_role();
    if v_role not in ('diretoria', 'admin', 'rh') then
      raise exception 'apenas diretoria/admin/rh podem alterar status ou etapa do projeto';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_projects_status_stage_update_role on public.projects;
create trigger trg_validate_projects_status_stage_update_role
before update on public.projects
for each row
execute function public.validate_projects_status_stage_update_role();

commit;

