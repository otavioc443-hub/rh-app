begin;

drop policy if exists projects_insert_gestor_admin_rh on public.projects;
create policy projects_insert_gestor_admin_rh
on public.projects
for insert
to authenticated
with check (
  (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.role in ('gestor', 'admin', 'rh')
    )
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role = 'diretoria'
  )
);

drop policy if exists projects_update_owner_admin_rh on public.projects;
create policy projects_update_owner_admin_rh
on public.projects
for update
to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh', 'diretoria')
  )
)
with check (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh', 'diretoria')
  )
);

commit;

