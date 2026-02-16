-- Update current_role() and is_rh_or_admin() to consider cargos.portal_role
-- Execute no Supabase SQL Editor com permissao de owner/admin.

begin;

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
  -- Keep admin/RH always from profiles (avoid privilege escalation via cargo mapping).
  select p.role
    into v_profile_role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_profile_role in ('admin', 'rh') then
    return v_profile_role;
  end if;

  -- Derive from collaborator's cargo mapping (if set).
  -- NOTE: neste schema, colaboradores.cargo e' texto (nao existe cargo_id).
  select cg.portal_role
    into v_cargo_role
  from public.colaboradores c
  join public.cargos cg on lower(trim(cg.name)) = lower(trim(c.cargo))
  where c.user_id = auth.uid()
  limit 1;

  return coalesce(v_cargo_role, v_profile_role, 'colaborador');
end;
$$;

create or replace function public.is_rh_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.current_role() in ('rh', 'admin');
$$;

grant execute on function public.current_role() to authenticated;
grant execute on function public.is_rh_or_admin() to authenticated;

commit;
