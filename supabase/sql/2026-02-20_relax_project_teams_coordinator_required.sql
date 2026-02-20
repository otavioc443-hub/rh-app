begin;

-- Permite criar equipe sem coordenador no momento da criacao.
-- A definicao pode ser feita depois dentro da propria equipe.
create or replace function public.validate_project_team_coordinator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.coordinator_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.project_members pm
    where pm.project_id = new.project_id
      and pm.user_id = new.coordinator_user_id
      and pm.member_role = 'coordenador'
  ) then
    raise exception 'coordenador da equipe deve ter papel coordenador no projeto';
  end if;

  return new;
end;
$$;

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

commit;
