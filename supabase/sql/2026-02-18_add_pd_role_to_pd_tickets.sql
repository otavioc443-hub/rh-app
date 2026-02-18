begin;

drop policy if exists pd_tickets_select on public.pd_tickets;
create policy pd_tickets_select
on public.pd_tickets
for select
to authenticated
using (
  public.current_active() = true
  and (
    requester_user_id = auth.uid()
    or public.current_role() in ('admin', 'rh', 'financeiro', 'gestor', 'pd')
  )
);

drop policy if exists pd_tickets_update_support on public.pd_tickets;
create policy pd_tickets_update_support
on public.pd_tickets
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro', 'gestor', 'pd')
)
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'rh', 'financeiro', 'gestor', 'pd')
);

commit;
