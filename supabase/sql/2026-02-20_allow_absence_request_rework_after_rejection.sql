begin;

alter table if exists public.absence_requests enable row level security;

-- Substitui a policy anterior para permitir retrabalho apos recusa.
drop policy if exists absence_requests_update_own_pending on public.absence_requests;
create policy absence_requests_update_own_pending
on public.absence_requests
for update
to authenticated
using (
  public.current_active() = true
  and user_id = auth.uid()
  and status in ('pending_manager', 'rejected')
)
with check (
  public.current_active() = true
  and user_id = auth.uid()
  and status in ('pending_manager', 'rejected', 'cancelled')
);

commit;

