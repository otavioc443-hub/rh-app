begin;

-- Permite que a diretoria visualize/cadastre/edite entregaveis de projetos
-- sem depender de membership em project_members.

drop policy if exists deliverables_select_project_member on public.project_deliverables;
create policy deliverables_select_project_member
on public.project_deliverables
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_deliverables.project_id
      and pm.user_id = auth.uid()
  )
  or (
    public.current_active() = true
    and public.current_role() in ('admin', 'rh', 'diretoria')
  )
);

drop policy if exists deliverables_insert_manager on public.project_deliverables;
create policy deliverables_insert_manager
on public.project_deliverables
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects pr
    where pr.id = project_deliverables.project_id
      and (
        pr.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = pr.id
            and pm.user_id = auth.uid()
            and pm.member_role in ('gestor', 'coordenador')
        )
        or (
          public.current_active() = true
          and public.current_role() in ('admin', 'rh', 'diretoria')
        )
      )
  )
);

drop policy if exists deliverables_update_member on public.project_deliverables;
create policy deliverables_update_member
on public.project_deliverables
for update
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_deliverables.project_id
      and pm.user_id = auth.uid()
  )
  or (
    public.current_active() = true
    and public.current_role() in ('admin', 'rh', 'diretoria')
  )
)
with check (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_deliverables.project_id
      and pm.user_id = auth.uid()
  )
  or (
    public.current_active() = true
    and public.current_role() in ('admin', 'rh', 'diretoria')
  )
);

commit;

