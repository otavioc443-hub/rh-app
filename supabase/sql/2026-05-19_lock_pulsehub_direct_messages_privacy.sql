begin;

alter table public.internal_social_direct_messages enable row level security;

drop policy if exists internal_social_direct_messages_select_auth
on public.internal_social_direct_messages;

create policy internal_social_direct_messages_select_participants_only
on public.internal_social_direct_messages
for select
to authenticated
using (
  from_user_id = auth.uid()
  or to_user_id = auth.uid()
  or public.current_role() = 'admin'
);

drop policy if exists internal_social_direct_messages_insert_auth
on public.internal_social_direct_messages;

create policy internal_social_direct_messages_insert_sender_only
on public.internal_social_direct_messages
for insert
to authenticated
with check (
  from_user_id = auth.uid()
  and to_user_id is not null
  and to_user_id <> auth.uid()
);

drop policy if exists internal_social_direct_messages_update_blocked
on public.internal_social_direct_messages;

create policy internal_social_direct_messages_update_blocked
on public.internal_social_direct_messages
for update
to authenticated
using (false)
with check (false);

drop policy if exists internal_social_direct_messages_delete_blocked
on public.internal_social_direct_messages;

create policy internal_social_direct_messages_delete_blocked
on public.internal_social_direct_messages
for delete
to authenticated
using (false);

commit;
