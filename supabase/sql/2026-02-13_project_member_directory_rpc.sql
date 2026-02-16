begin;

-- Retorna "diretorio" seguro de membros do projeto (nome/cargo/avatar),
-- evitando expor e-mail para outros colaboradores.
-- SECURITY DEFINER + row_security=off evita recursao e permite compor dados (profiles + colaboradores)
-- com checagem explicita de permissao.
create or replace function public.project_member_directory(p_project_id uuid)
returns table (
  user_id uuid,
  display_name text,
  cargo text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select
    pm.user_id,
    coalesce(
      nullif(trim(c.nome), ''),
      case
        when position('@' in coalesce(trim(p.full_name), '')) > 0 then null
        else nullif(trim(p.full_name), '')
      end,
      'Colaborador ' || left(pm.user_id::text, 8)
    ) as display_name,
    nullif(trim(c.cargo), '') as cargo,
    nullif(trim(p.avatar_url), '') as avatar_url
  from public.project_members pm
  left join public.profiles p on p.id = pm.user_id
  left join lateral (
    select c.nome, c.cargo
    from public.colaboradores c
    where c.user_id = pm.user_id
      or (
        p.email is not null
        and nullif(trim(c.email), '') is not null
        and lower(trim(c.email)) = lower(trim(p.email))
      )
    order by
      case when c.user_id = pm.user_id then 0 else 1 end,
      c.updated_at desc nulls last,
      c.created_at desc nulls last
    limit 1
  ) c on true
  where pm.project_id = p_project_id
    and public.current_active() = true
    and (
      public.current_role() in ('admin', 'rh', 'financeiro')
      or exists (
        select 1
        from public.project_members me
        where me.project_id = p_project_id
          and me.user_id = auth.uid()
      )
    )
  order by display_name asc;
$$;

grant execute on function public.project_member_directory(uuid) to authenticated;

commit;
