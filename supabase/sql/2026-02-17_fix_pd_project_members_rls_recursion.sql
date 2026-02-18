begin;

-- Helpers para evitar recursao de RLS em pd_project_members.
create or replace function public.pd_is_project_member(_project_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.pd_project_members m
    where m.project_id = _project_id
      and m.user_id = _user_id
      and m.is_active = true
  );
$$;

create or replace function public.pd_is_project_gestor(_project_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.pd_project_members m
    where m.project_id = _project_id
      and m.user_id = _user_id
      and m.is_active = true
      and m.member_role = 'gestor_pd'
  );
$$;

create or replace function public.pd_is_project_gestor_or_coordenador(_project_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.pd_project_members m
    where m.project_id = _project_id
      and m.user_id = _user_id
      and m.is_active = true
      and m.member_role in ('gestor_pd', 'coordenador_pd')
  );
$$;

grant execute on function public.pd_is_project_member(uuid, uuid) to authenticated;
grant execute on function public.pd_is_project_gestor(uuid, uuid) to authenticated;
grant execute on function public.pd_is_project_gestor_or_coordenador(uuid, uuid) to authenticated;

-- Recria policies de pd_project_members sem subquery direta na mesma tabela.
drop policy if exists pd_project_members_select on public.pd_project_members;
create policy pd_project_members_select
on public.pd_project_members
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or user_id = auth.uid()
    or public.pd_is_project_member(project_id, auth.uid())
  )
);

drop policy if exists pd_project_members_insert on public.pd_project_members;
create policy pd_project_members_insert
on public.pd_project_members
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
);

drop policy if exists pd_project_members_update on public.pd_project_members;
create policy pd_project_members_update
on public.pd_project_members
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
);

drop policy if exists pd_project_members_delete on public.pd_project_members;
create policy pd_project_members_delete
on public.pd_project_members
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
);

-- Reaplica nas demais tabelas do modulo para consistencia.
drop policy if exists pd_projects_select on public.pd_projects;
create policy pd_projects_select
on public.pd_projects
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or owner_user_id = auth.uid()
    or public.pd_is_project_member(id, auth.uid())
  )
);

drop policy if exists pd_projects_update on public.pd_projects;
create policy pd_projects_update
on public.pd_projects
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or owner_user_id = auth.uid()
    or public.pd_is_project_gestor(id, auth.uid())
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or owner_user_id = auth.uid()
    or public.pd_is_project_gestor(id, auth.uid())
  )
);

drop policy if exists pd_project_teams_select on public.pd_project_teams;
create policy pd_project_teams_select
on public.pd_project_teams
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or public.pd_is_project_member(project_id, auth.uid())
  )
);

drop policy if exists pd_project_teams_insert on public.pd_project_teams;
create policy pd_project_teams_insert
on public.pd_project_teams
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_teams.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
);

drop policy if exists pd_project_teams_update on public.pd_project_teams;
create policy pd_project_teams_update
on public.pd_project_teams
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_teams.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_teams.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
);

drop policy if exists pd_project_teams_delete on public.pd_project_teams;
create policy pd_project_teams_delete
on public.pd_project_teams
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_teams.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
);

drop policy if exists pd_project_team_members_select on public.pd_project_team_members;
create policy pd_project_team_members_select
on public.pd_project_team_members
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or user_id = auth.uid()
    or public.pd_is_project_member(project_id, auth.uid())
  )
);

drop policy if exists pd_project_team_members_insert on public.pd_project_team_members;
create policy pd_project_team_members_insert
on public.pd_project_team_members
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_team_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
);

drop policy if exists pd_project_team_members_delete on public.pd_project_team_members;
create policy pd_project_team_members_delete
on public.pd_project_team_members
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_team_members.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
);

drop policy if exists pd_project_actions_select on public.pd_project_actions;
create policy pd_project_actions_select
on public.pd_project_actions
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh', 'financeiro', 'gestor')
    or assigned_to = auth.uid()
    or public.pd_is_project_member(project_id, auth.uid())
  )
);

drop policy if exists pd_project_actions_insert on public.pd_project_actions;
create policy pd_project_actions_insert
on public.pd_project_actions
for insert
to authenticated
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_actions.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor_or_coordenador(project_id, auth.uid())
  )
);

drop policy if exists pd_project_actions_update on public.pd_project_actions;
create policy pd_project_actions_update
on public.pd_project_actions
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or assigned_to = auth.uid()
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_actions.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor_or_coordenador(project_id, auth.uid())
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or assigned_to = auth.uid()
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_actions.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor_or_coordenador(project_id, auth.uid())
  )
);

drop policy if exists pd_project_actions_delete on public.pd_project_actions;
create policy pd_project_actions_delete
on public.pd_project_actions
for delete
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() = 'admin'
    or exists (
      select 1
      from public.pd_projects p
      where p.id = pd_project_actions.project_id
        and p.owner_user_id = auth.uid()
    )
    or public.pd_is_project_gestor(project_id, auth.uid())
  )
);

commit;
