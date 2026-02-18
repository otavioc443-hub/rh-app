begin;

-- Criacao de equipes: somente gestor do projeto (ou admin).
drop policy if exists project_teams_write_manager on public.project_teams;

drop policy if exists project_teams_insert_gestor_only on public.project_teams;
create policy project_teams_insert_gestor_only
on public.project_teams
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_teams.project_id
        and pm.user_id = auth.uid()
        and pm.member_role = 'gestor'
    )
  )
);

-- Atualizacao/exclusao: gestor do projeto (ou admin).
drop policy if exists project_teams_update_gestor_only on public.project_teams;
create policy project_teams_update_gestor_only
on public.project_teams
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_teams.project_id
        and pm.user_id = auth.uid()
        and pm.member_role = 'gestor'
    )
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_teams.project_id
        and pm.user_id = auth.uid()
        and pm.member_role = 'gestor'
    )
  )
);

drop policy if exists project_teams_delete_gestor_only on public.project_teams;
create policy project_teams_delete_gestor_only
on public.project_teams
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_teams.project_id
        and pm.user_id = auth.uid()
        and pm.member_role = 'gestor'
    )
  )
);

commit;

