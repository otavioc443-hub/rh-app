begin;

create or replace function public.clear_project_deliverable_history(
  p_project_id uuid default null,
  p_deliverable_id uuid default null,
  p_reset_submission_fields boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deliverable_ids uuid[];
  v_timeline_deleted integer := 0;
  v_contributions_deleted integer := 0;
  v_files_deleted integer := 0;
  v_deliverables_updated integer := 0;
begin
  if public.current_active() is distinct from true then
    raise exception 'usuario inativo';
  end if;

  if public.current_role() not in ('admin', 'super_admin') then
    raise exception 'sem permissao para limpar historico de entregaveis';
  end if;

  if p_project_id is null and p_deliverable_id is null then
    raise exception 'informe p_project_id ou p_deliverable_id';
  end if;

  select array_agg(d.id)
  into v_deliverable_ids
  from public.project_deliverables d
  join public.projects p on p.id = d.project_id
  where
    (p_project_id is null or d.project_id = p_project_id)
    and (p_deliverable_id is null or d.id = p_deliverable_id)
    and (
      public.current_role() = 'super_admin'
      or (
        public.current_company_id() is not null
        and p.company_id = public.current_company_id()
      )
    );

  if coalesce(array_length(v_deliverable_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'ok', true,
      'message', 'nenhum entregavel encontrado para o filtro informado',
      'timeline_deleted', 0,
      'contributions_deleted', 0,
      'files_deleted', 0,
      'deliverables_updated', 0
    );
  end if;

  delete from public.project_deliverable_timeline
  where deliverable_id = any(v_deliverable_ids);
  get diagnostics v_timeline_deleted = row_count;

  delete from public.deliverable_contributions
  where deliverable_id = any(v_deliverable_ids);
  get diagnostics v_contributions_deleted = row_count;

  delete from public.project_deliverable_files
  where deliverable_id = any(v_deliverable_ids);
  get diagnostics v_files_deleted = row_count;

  if p_reset_submission_fields then
    update public.project_deliverables
    set
      submitted_by = null,
      submitted_at = null,
      approval_comment = null
    where id = any(v_deliverable_ids);
    get diagnostics v_deliverables_updated = row_count;
  end if;

  return jsonb_build_object(
    'ok', true,
    'timeline_deleted', v_timeline_deleted,
    'contributions_deleted', v_contributions_deleted,
    'files_deleted', v_files_deleted,
    'deliverables_updated', v_deliverables_updated
  );
end;
$$;

grant execute on function public.clear_project_deliverable_history(uuid, uuid, boolean) to authenticated;

commit;

