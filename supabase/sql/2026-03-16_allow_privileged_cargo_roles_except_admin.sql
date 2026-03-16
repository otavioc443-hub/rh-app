begin;

-- Permite que RH e Financeiro sejam herdados do cargo.
-- Admin continua exclusivo de profiles.role para evitar escalacao maxima via cargo.
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

  if v_profile_role = 'admin' then
    return v_profile_role;
  end if;

  select cg.portal_role
    into v_cargo_role
  from public.colaboradores c
  join public.cargos cg on lower(trim(cg.name)) = lower(trim(c.cargo))
  where c.user_id = auth.uid()
  limit 1;

  if v_cargo_role = 'admin' then
    v_cargo_role := null;
  end if;

  return coalesce(v_cargo_role, v_profile_role, 'colaborador');
end;
$$;

grant execute on function public.current_role() to authenticated;

commit;
