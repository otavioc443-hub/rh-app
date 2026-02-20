begin;

alter table if exists public.project_teams
  add column if not exists coordinator_user_id uuid null references auth.users(id) on delete set null;

create index if not exists idx_project_teams_coordinator
  on public.project_teams(coordinator_user_id);

create or replace function public.validate_project_team_coordinator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.coordinator_user_id is null then
    raise exception 'coordenador da equipe e obrigatorio';
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

drop trigger if exists trg_validate_project_team_coordinator on public.project_teams;
create trigger trg_validate_project_team_coordinator
before insert or update on public.project_teams
for each row
execute function public.validate_project_team_coordinator();

-- Backfill para equipes antigas sem coordenador.
update public.project_teams t
set coordinator_user_id = sub.user_id
from (
  select distinct on (tm.team_id)
    tm.team_id,
    tm.user_id
  from public.project_team_members tm
  join public.project_members pm
    on pm.project_id = tm.project_id
   and pm.user_id = tm.user_id
  where pm.member_role = 'coordenador'
  order by tm.team_id, tm.created_at asc
) sub
where t.id = sub.team_id
  and t.coordinator_user_id is null;

-- Policies de equipes (gestor/admin continuam gerindo; agora exigem coordenador definido).
drop policy if exists project_teams_insert_gestor_only on public.project_teams;
create policy project_teams_insert_gestor_only
on public.project_teams
for insert
to authenticated
with check (
  public.current_active() = true
  and coordinator_user_id is not null
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
  and coordinator_user_id is not null
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

-- Membros da equipe: gestor/admin ou coordenador responsavel daquela equipe.
drop policy if exists project_team_members_write_manager on public.project_team_members;
drop policy if exists project_team_members_insert_team_coordinator on public.project_team_members;
drop policy if exists project_team_members_update_team_coordinator on public.project_team_members;
drop policy if exists project_team_members_delete_team_coordinator on public.project_team_members;

create policy project_team_members_insert_team_coordinator
on public.project_team_members
for insert
to authenticated
with check (
  public.current_active() = true
  and exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_team_members.project_id
      and pm.user_id = project_team_members.user_id
  )
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_team_members.project_id
        and pm.user_id = auth.uid()
        and pm.member_role = 'gestor'
    )
    or exists (
      select 1
      from public.project_teams t
      where t.id = project_team_members.team_id
        and t.project_id = project_team_members.project_id
        and t.coordinator_user_id = auth.uid()
    )
  )
);

create policy project_team_members_update_team_coordinator
on public.project_team_members
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_team_members.project_id
        and pm.user_id = auth.uid()
        and pm.member_role = 'gestor'
    )
    or exists (
      select 1
      from public.project_teams t
      where t.id = project_team_members.team_id
        and t.project_id = project_team_members.project_id
        and t.coordinator_user_id = auth.uid()
    )
  )
)
with check (
  public.current_active() = true
  and exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_team_members.project_id
      and pm.user_id = project_team_members.user_id
  )
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_team_members.project_id
        and pm.user_id = auth.uid()
        and pm.member_role = 'gestor'
    )
    or exists (
      select 1
      from public.project_teams t
      where t.id = project_team_members.team_id
        and t.project_id = project_team_members.project_id
        and t.coordinator_user_id = auth.uid()
    )
  )
);

create policy project_team_members_delete_team_coordinator
on public.project_team_members
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_team_members.project_id
        and pm.user_id = auth.uid()
        and pm.member_role = 'gestor'
    )
    or exists (
      select 1
      from public.project_teams t
      where t.id = project_team_members.team_id
        and t.project_id = project_team_members.project_id
        and t.coordinator_user_id = auth.uid()
    )
  )
);

commit;

