begin;

create or replace function public.bind_profile_to_company(
  p_user_id uuid,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_company_id is null then
    raise exception 'p_user_id e p_company_id sao obrigatorios';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'usuario nao encontrado';
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    raise exception 'empresa nao encontrada';
  end if;

  -- SQL Editor/service role sem JWT.
  if auth.uid() is null then
    insert into public.profiles (id, company_id, active)
    values (p_user_id, p_company_id, true)
    on conflict (id)
    do update set
      company_id = excluded.company_id,
      active = true;
    return;
  end if;

  -- Regra solicitada: admin (e super_admin) podem vincular independente do company_id atual.
  if public.is_super_admin() is distinct from true and public.current_role() <> 'admin' then
    raise exception 'sem permissao';
  end if;

  insert into public.profiles (id, company_id, active)
  values (p_user_id, p_company_id, true)
  on conflict (id)
  do update set
    company_id = excluded.company_id,
    active = true;
end;
$$;

grant execute on function public.bind_profile_to_company(uuid, uuid) to authenticated;

commit;

