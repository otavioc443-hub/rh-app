create table if not exists public.internal_social_message_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_social_message_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.internal_social_message_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint internal_social_message_group_members_unique unique (group_id, user_id)
);

create table if not exists public.internal_social_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.internal_social_message_groups(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  from_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_social_message_group_members_group
  on public.internal_social_message_group_members(group_id, created_at desc);

create index if not exists idx_internal_social_message_group_members_user
  on public.internal_social_message_group_members(user_id, created_at desc);

create index if not exists idx_internal_social_group_messages_group
  on public.internal_social_group_messages(group_id, created_at desc);

create or replace function public.internal_social_is_message_group_member(target_group_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.internal_social_message_group_members mgm
    where mgm.group_id = target_group_id
      and mgm.user_id = coalesce(target_user_id, auth.uid())
  );
$$;

alter table public.internal_social_message_groups enable row level security;
alter table public.internal_social_message_group_members enable row level security;
alter table public.internal_social_group_messages enable row level security;

drop policy if exists internal_social_message_groups_select_member on public.internal_social_message_groups;
create policy internal_social_message_groups_select_member
on public.internal_social_message_groups
for select
to authenticated
using (
  public.internal_social_is_message_group_member(id)
  or created_by = auth.uid()
);

drop policy if exists internal_social_message_groups_insert_auth on public.internal_social_message_groups;
create policy internal_social_message_groups_insert_auth
on public.internal_social_message_groups
for insert
to authenticated
with check (
  created_by = auth.uid()
);

drop policy if exists internal_social_message_group_members_select_member on public.internal_social_message_group_members;
create policy internal_social_message_group_members_select_member
on public.internal_social_message_group_members
for select
to authenticated
using (
  public.internal_social_is_message_group_member(group_id)
);

drop policy if exists internal_social_message_group_members_insert_creator on public.internal_social_message_group_members;
create policy internal_social_message_group_members_insert_creator
on public.internal_social_message_group_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.internal_social_message_groups g
    where g.id = group_id
      and g.created_by = auth.uid()
  )
);

drop policy if exists internal_social_group_messages_select_member on public.internal_social_group_messages;
create policy internal_social_group_messages_select_member
on public.internal_social_group_messages
for select
to authenticated
using (
  public.internal_social_is_message_group_member(group_id)
);

drop policy if exists internal_social_group_messages_insert_member on public.internal_social_group_messages;
create policy internal_social_group_messages_insert_member
on public.internal_social_group_messages
for insert
to authenticated
with check (
  from_user_id = auth.uid()
  and public.internal_social_is_message_group_member(group_id)
);
