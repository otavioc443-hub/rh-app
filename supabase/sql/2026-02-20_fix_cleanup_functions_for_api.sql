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
  -- Chamadas tecnicas via service role (auth.uid() null) sao permitidas.
  -- Chamadas de usuario continuam exigindo sessao ativa e role admin.
  if auth.uid() is not null then
    if public.current_active() is distinct from true then
      raise exception 'usuario inativo';
    end if;

    if public.current_role() <> 'admin' then
      raise exception 'sem permissao para limpar historico de entregaveis';
    end if;
  end if;

  if p_project_id is null and p_deliverable_id is null then
    raise exception 'informe p_project_id ou p_deliverable_id';
  end if;

  select array_agg(d.id)
  into v_deliverable_ids
  from public.project_deliverables d
  where
    (p_project_id is null or d.project_id = p_project_id)
    and (p_deliverable_id is null or d.id = p_deliverable_id);

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

create or replace function public.clear_company_project_data(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_ids uuid[];
  v_projects_deleted integer := 0;
  v_deliverable_files_deleted integer := 0;
begin
  if p_company_id is null then
    raise exception 'p_company_id obrigatorio';
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    raise exception 'empresa nao encontrada';
  end if;

  -- Chamadas de usuario: exige admin. Service role: permitido para API interna.
  if auth.uid() is not null and public.current_role() <> 'admin' then
    raise exception 'sem permissao';
  end if;

  select array_agg(p.id)
  into v_project_ids
  from public.projects p
  where p.company_id = p_company_id;

  if coalesce(array_length(v_project_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'ok', true,
      'projects_deleted', 0,
      'deliverable_files_deleted', 0,
      'message', 'nenhum projeto encontrado para a empresa'
    );
  end if;

  delete from public.project_deliverable_files
  where project_id = any(v_project_ids);
  get diagnostics v_deliverable_files_deleted = row_count;

  delete from public.projects
  where id = any(v_project_ids);
  get diagnostics v_projects_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'projects_deleted', v_projects_deleted,
    'deliverable_files_deleted', v_deliverable_files_deleted
  );
end;
$$;

grant execute on function public.clear_company_project_data(uuid) to authenticated;

commit;
