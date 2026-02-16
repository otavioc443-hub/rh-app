-- RPC para obter labels (nome/e-mail) dos membros de um projeto
-- Resolve o problema de mostrar UUID na UI quando profiles tem RLS restritivo.
-- Execute no Supabase SQL Editor com permissao de owner/admin.

begin;

create or replace function public.project_member_labels(p_project_id uuid)
returns table (
  user_id uuid,
  member_role text,
  label text
)
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select
    pm.user_id,
    pm.member_role,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.email), ''),
      nullif(trim(c.nome), ''),
      nullif(trim(c.email), ''),
      pm.user_id::text
    ) as label
  from public.project_members pm
  left join public.profiles p on p.id = pm.user_id
  left join lateral (
    select c1.nome, c1.email
    from public.colaboradores c1
    where c1.user_id = pm.user_id
       or (p.email is not null and lower(trim(c1.email)) = lower(trim(p.email)))
    order by
      case when c1.user_id = pm.user_id then 0 else 1 end,
      c1.id asc
    limit 1
  ) c on true
  where pm.project_id = p_project_id
    and (
      -- qualquer membro do projeto pode ver os labels dos membros
      exists (
        select 1
        from public.project_members pm2
        where pm2.project_id = p_project_id
          and pm2.user_id = auth.uid()
      )
      or public.current_role() in ('admin', 'rh')
    )
  order by pm.member_role, label;
$$;

grant execute on function public.project_member_labels(uuid) to authenticated;

commit;
