begin;

-- Compatibilidade: onde hoje o sistema espera "admin", o super_admin deve passar.
-- Estratégia:
-- 1) current_role() retorna "admin" quando o profile.role = "super_admin".
-- 2) is_super_admin() checa o role real no profile, sem depender de current_role().

create or replace function public.current_role()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_profile_role text;
  v_cargo_role text;
begin
  select p.role
    into v_profile_role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  -- super_admin herda completamente o comportamento de admin.
  if v_profile_role = 'super_admin' then
    return 'admin';
  end if;

  -- Roles privilegiadas SOMENTE por profiles (evita escalacao via cargo).
  if v_profile_role in ('admin', 'rh', 'financeiro') then
    return v_profile_role;
  end if;

  select cg.portal_role
    into v_cargo_role
  from public.colaboradores c
  join public.cargos cg on lower(trim(cg.name)) = lower(trim(c.cargo))
  where c.user_id = auth.uid()
  limit 1;

  if v_cargo_role in ('super_admin', 'admin', 'rh', 'financeiro') then
    v_cargo_role := null;
  end if;

  return coalesce(v_cargo_role, v_profile_role, 'colaborador');
end;
$$;

grant execute on function public.current_role() to authenticated;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role = 'super_admin'
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

commit;

