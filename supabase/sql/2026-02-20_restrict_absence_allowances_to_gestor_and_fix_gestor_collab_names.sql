begin;

-- 1) Ajusta leitura de absence_allowances: remove coordenador do escopo da tela do gestor.
drop policy if exists absence_allowances_select_team_gestor on public.absence_allowances;
create policy absence_allowances_select_team_gestor
on public.absence_allowances
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh')
    or user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = absence_allowances.user_id
        and p.manager_id = auth.uid()
        and p.active = true
    )
    or exists (
      select 1
      from public.project_members me
      join public.project_members other on other.project_id = me.project_id
      where me.user_id = auth.uid()
        and me.member_role = 'gestor'
        and other.user_id = absence_allowances.user_id
    )
    or exists (
      select 1
      from public.colaboradores c
      left join public.profiles p on p.id = c.user_id
      where c.id = absence_allowances.collaborator_id
        and (
          c.user_id = auth.uid()
          or (p.id is not null and p.manager_id = auth.uid() and coalesce(p.active, true) = true)
          or exists (
            select 1
            from public.project_members me
            join public.project_members other on other.project_id = me.project_id
            where me.user_id = auth.uid()
              and me.member_role = 'gestor'
              and other.user_id = c.user_id
          )
        )
    )
  )
);

-- 2) Permite ao gestor ler nomes de colaboradores da sua equipe (para RH/Gestor > Ausencias).
drop policy if exists colaboradores_select_gestor_team on public.colaboradores;
create policy colaboradores_select_gestor_team
on public.colaboradores
for select
to authenticated
using (
  public.current_active()
  and public.current_role() = 'gestor'
  and (
    colaboradores.user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = colaboradores.user_id
        and p.active = true
        and p.manager_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members me
      join public.project_members other on other.project_id = me.project_id
      where me.user_id = auth.uid()
        and me.member_role = 'gestor'
        and other.user_id = colaboradores.user_id
    )
  )
);

commit;

