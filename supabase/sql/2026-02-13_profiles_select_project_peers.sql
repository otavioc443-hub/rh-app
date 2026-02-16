-- Permite que membros do mesmo projeto vejam nomes/avatares (profiles) entre si.
-- Importante: evita recursao de RLS usando helper SECURITY DEFINER com row_security = off.

begin;

-- Helper: true se o usuario logado compartilha qualquer projeto com o usuario alvo.
create or replace function public.rls_share_project_with(p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.project_members me
    join public.project_members other on other.project_id = me.project_id
    where me.user_id = auth.uid()
      and other.user_id = p_target_user_id
  );
$$;

grant execute on function public.rls_share_project_with(uuid) to authenticated;

-- Policy: SELECT em profiles para self, admin/rh/financeiro, ou peers do mesmo projeto.
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self_or_project_peers on public.profiles;
create policy profiles_select_self_or_project_peers
on public.profiles
for select
to authenticated
using (
  public.current_active() = true
  and (
    id = auth.uid()
    or public.current_role() in ('admin','rh','financeiro')
    or public.rls_share_project_with(id)
  )
);

commit;

