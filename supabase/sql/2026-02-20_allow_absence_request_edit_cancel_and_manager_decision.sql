begin;

alter table if exists public.absence_requests enable row level security;

-- Colaborador: pode atualizar/cancelar apenas solicitacoes proprias pendentes.
drop policy if exists absence_requests_update_own_pending on public.absence_requests;
create policy absence_requests_update_own_pending
on public.absence_requests
for update
to authenticated
using (
  public.current_active() = true
  and user_id = auth.uid()
  and status = 'pending_manager'
)
with check (
  public.current_active() = true
  and user_id = auth.uid()
  and status in ('pending_manager', 'cancelled')
);

-- Gestor (e admin/rh): decidir solicitacoes da equipe.
drop policy if exists absence_requests_update_manager_decision on public.absence_requests;
create policy absence_requests_update_manager_decision
on public.absence_requests
for update
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh')
    or (
      public.current_role() = 'gestor'
      and (
        manager_id = auth.uid()
        or exists (
          select 1
          from public.project_members me
          join public.project_members other on other.project_id = me.project_id
          where me.user_id = auth.uid()
            and me.member_role = 'gestor'
            and other.user_id = absence_requests.user_id
        )
      )
    )
  )
)
with check (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh')
    or (
      public.current_role() = 'gestor'
      and (
        manager_id = auth.uid()
        or exists (
          select 1
          from public.project_members me
          join public.project_members other on other.project_id = me.project_id
          where me.user_id = auth.uid()
            and me.member_role = 'gestor'
            and other.user_id = absence_requests.user_id
        )
      )
    )
  )
  and status in ('pending_manager', 'approved', 'rejected', 'cancelled')
);

commit;

