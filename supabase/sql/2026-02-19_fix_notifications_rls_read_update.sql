begin;

alter table if exists public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
to authenticated
using (
  to_user_id = auth.uid()
);

drop policy if exists notifications_update_read_own on public.notifications;
create policy notifications_update_read_own
on public.notifications
for update
to authenticated
using (
  to_user_id = auth.uid()
)
with check (
  to_user_id = auth.uid()
);

commit;
