begin;

-- Reafirma a permissao da diretoria para criar/editar projetos.
-- Use esta migration se o banco atual ainda estiver com a policy antiga sem "diretoria".

drop policy if exists projects_insert_gestor_admin_rh on public.projects;
create policy projects_insert_gestor_admin_rh
on public.projects
for insert
to authenticated
with check (
  (
    owner_user_id = auth.uid()
    and public.current_active() = true
    and public.current_role() in ('gestor', 'admin', 'rh')
  )
  or (
    public.current_active() = true
    and public.current_role() = 'diretoria'
  )
);

drop policy if exists projects_update_owner_admin_rh on public.projects;
create policy projects_update_owner_admin_rh
on public.projects
for update
to authenticated
using (
  (
    owner_user_id = auth.uid()
    and public.current_active() = true
  )
  or (
    public.current_active() = true
    and public.current_role() in ('admin', 'rh', 'diretoria')
  )
)
with check (
  (
    owner_user_id = auth.uid()
    and public.current_active() = true
  )
  or (
    public.current_active() = true
    and public.current_role() in ('admin', 'rh', 'diretoria')
  )
);

commit;
