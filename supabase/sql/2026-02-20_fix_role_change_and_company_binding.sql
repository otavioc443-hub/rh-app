begin;

-- 1) Ajusta trigger de bloqueio de role para permitir manutencao por admin/super_admin
-- e por sessao sem auth.uid() (SQL editor/service role).
create or replace function public.block_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Operacao tecnica (ex.: SQL Editor/service role sem JWT): permite.
  if auth.uid() is null then
    return new;
  end if;

  -- Admin efetivo (inclui super_admin via compat) ou super_admin real podem alterar role.
  if public.current_role() = 'admin' or public.is_super_admin() = true then
    return new;
  end if;

  raise exception 'Somente admin pode alterar role';
end;
$$;

-- 2) Funcao segura para vincular usuario a empresa (company_id)
create or replace function public.bind_profile_to_company(
  p_user_id uuid,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_company_id uuid;
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

  -- Permissoes:
  -- super_admin: pode vincular qualquer usuario a qualquer empresa
  -- admin: somente dentro da propria empresa
  if public.is_super_admin() is distinct from true then
    if public.current_role() <> 'admin' then
      raise exception 'sem permissao';
    end if;

    v_actor_company_id := public.current_company_id();
    if v_actor_company_id is null or v_actor_company_id <> p_company_id then
      raise exception 'admin so pode vincular usuarios na propria empresa';
    end if;
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

-- 3) Atalho para auto-vinculo do usuario logado
create or replace function public.bind_me_to_company(
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'usuario nao autenticado';
  end if;

  perform public.bind_profile_to_company(auth.uid(), p_company_id);
end;
$$;

grant execute on function public.bind_me_to_company(uuid) to authenticated;

commit;
