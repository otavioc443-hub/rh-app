begin;

create table if not exists public.internal_social_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  cover_color text not null default '#0f172a',
  is_private boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_social_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.internal_social_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint internal_social_group_members_unique unique (group_id, user_id),
  constraint internal_social_group_members_role_check check (role in ('owner', 'moderator', 'member'))
);

create index if not exists idx_internal_social_group_members_group
  on public.internal_social_group_members(group_id, created_at desc);

create index if not exists idx_internal_social_group_members_user
  on public.internal_social_group_members(user_id, created_at desc);

alter table if exists public.internal_social_posts
  add column if not exists audience_group_id uuid null references public.internal_social_groups(id) on delete cascade;

alter table if exists public.internal_social_posts
  drop constraint if exists internal_social_posts_audience_type_check;

alter table if exists public.internal_social_posts
  add constraint internal_social_posts_audience_type_check
  check (audience_type in ('company', 'project', 'group'));

create table if not exists public.internal_social_polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.internal_social_posts(id) on delete cascade,
  question text not null,
  allow_multiple boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_social_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.internal_social_polls(id) on delete cascade,
  label text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_social_poll_options_poll
  on public.internal_social_poll_options(poll_id, position asc, created_at asc);

create table if not exists public.internal_social_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.internal_social_polls(id) on delete cascade,
  option_id uuid not null references public.internal_social_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint internal_social_poll_votes_unique unique (poll_id, option_id, user_id)
);

create index if not exists idx_internal_social_poll_votes_poll
  on public.internal_social_poll_votes(poll_id, created_at desc);

create table if not exists public.internal_social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  post_id uuid null references public.internal_social_posts(id) on delete cascade,
  comment_id uuid null references public.internal_social_post_comments(id) on delete cascade,
  reason text not null,
  details text null,
  status text not null default 'open',
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint internal_social_reports_target_type_check check (target_type in ('post', 'comment')),
  constraint internal_social_reports_status_check check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint internal_social_reports_target_check check (
    (target_type = 'post' and post_id is not null and comment_id is null)
    or (target_type = 'comment' and post_id is null and comment_id is not null)
  )
);

create index if not exists idx_internal_social_reports_status_created
  on public.internal_social_reports(status, created_at desc);

create table if not exists public.internal_social_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid null references public.internal_social_reports(id) on delete set null,
  moderator_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id uuid null,
  notes text null,
  created_at timestamptz not null default now(),
  constraint internal_social_moderation_actions_action_check check (action in ('reviewing', 'resolved', 'dismissed', 'hide_post', 'restore_post')),
  constraint internal_social_moderation_actions_target_check check (target_type in ('post', 'comment', 'report', 'system'))
);

alter table if exists public.internal_social_groups enable row level security;
alter table if exists public.internal_social_group_members enable row level security;
alter table if exists public.internal_social_polls enable row level security;
alter table if exists public.internal_social_poll_options enable row level security;
alter table if exists public.internal_social_poll_votes enable row level security;
alter table if exists public.internal_social_reports enable row level security;
alter table if exists public.internal_social_moderation_actions enable row level security;

drop policy if exists internal_social_groups_select_auth on public.internal_social_groups;
create policy internal_social_groups_select_auth
on public.internal_social_groups
for select
to authenticated
using (
  is_private = false
  or exists (
    select 1
    from public.internal_social_group_members gm
    where gm.group_id = internal_social_groups.id
      and gm.user_id = auth.uid()
  )
  or public.current_role() in ('admin', 'diretoria')
);

drop policy if exists internal_social_groups_insert_admin on public.internal_social_groups;
create policy internal_social_groups_insert_admin
on public.internal_social_groups
for insert
to authenticated
with check (public.current_role() in ('admin', 'diretoria', 'rh'));

drop policy if exists internal_social_group_members_select_auth on public.internal_social_group_members;
create policy internal_social_group_members_select_auth
on public.internal_social_group_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.internal_social_group_members gm
    where gm.group_id = internal_social_group_members.group_id
      and gm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.internal_social_groups g
    where g.id = internal_social_group_members.group_id
      and g.is_private = false
  )
  or public.current_role() in ('admin', 'diretoria')
);

drop policy if exists internal_social_group_members_insert_self_or_admin on public.internal_social_group_members;
create policy internal_social_group_members_insert_self_or_admin
on public.internal_social_group_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.current_role() in ('admin', 'diretoria', 'rh')
);

drop policy if exists internal_social_group_members_delete_self_or_admin on public.internal_social_group_members;
create policy internal_social_group_members_delete_self_or_admin
on public.internal_social_group_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.current_role() in ('admin', 'diretoria', 'rh')
);

drop policy if exists internal_social_group_members_update_admin on public.internal_social_group_members;
create policy internal_social_group_members_update_admin
on public.internal_social_group_members
for update
to authenticated
using (public.current_role() in ('admin', 'diretoria', 'rh'))
with check (public.current_role() in ('admin', 'diretoria', 'rh'));

drop policy if exists internal_social_posts_select_auth on public.internal_social_posts;
create policy internal_social_posts_select_auth
on public.internal_social_posts
for select
to authenticated
using (
  audience_type = 'company'
  or (
    audience_type = 'project'
    and audience_project_id is not null
    and exists (
      select 1
      from public.project_members pm
      where pm.project_id = audience_project_id
        and pm.user_id = auth.uid()
    )
  )
  or (
    audience_type = 'group'
    and audience_group_id is not null
    and (
      exists (
        select 1
        from public.internal_social_groups g
        where g.id = audience_group_id
          and g.is_private = false
      )
      or exists (
        select 1
        from public.internal_social_group_members gm
        where gm.group_id = audience_group_id
          and gm.user_id = auth.uid()
      )
    )
  )
  or public.current_role() in ('admin', 'diretoria')
);

drop policy if exists internal_social_posts_insert_auth on public.internal_social_posts;
create policy internal_social_posts_insert_auth
on public.internal_social_posts
for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and (
    audience_type = 'company'
    or (
      audience_type = 'project'
      and audience_project_id is not null
      and exists (
        select 1
        from public.project_members pm
        where pm.project_id = audience_project_id
          and pm.user_id = auth.uid()
      )
    )
    or (
      audience_type = 'group'
      and audience_group_id is not null
      and exists (
        select 1
        from public.internal_social_group_members gm
        where gm.group_id = audience_group_id
          and gm.user_id = auth.uid()
      )
    )
    or public.current_role() in ('admin', 'diretoria')
  )
);

drop policy if exists internal_social_post_attachments_select_auth on public.internal_social_post_attachments;
create policy internal_social_post_attachments_select_auth
on public.internal_social_post_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.internal_social_posts p
    where p.id = post_id
      and (
        p.audience_type = 'company'
        or (
          p.audience_type = 'project'
          and p.audience_project_id is not null
          and exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.audience_project_id
              and pm.user_id = auth.uid()
          )
        )
        or (
          p.audience_type = 'group'
          and p.audience_group_id is not null
          and (
            exists (
              select 1
              from public.internal_social_groups g
              where g.id = p.audience_group_id
                and g.is_private = false
            )
            or exists (
              select 1
              from public.internal_social_group_members gm
              where gm.group_id = p.audience_group_id
                and gm.user_id = auth.uid()
            )
          )
        )
        or public.current_role() in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_post_comments_select_auth on public.internal_social_post_comments;
create policy internal_social_post_comments_select_auth
on public.internal_social_post_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.internal_social_posts p
    where p.id = post_id
      and (
        p.audience_type = 'company'
        or (
          p.audience_type = 'project'
          and p.audience_project_id is not null
          and exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.audience_project_id
              and pm.user_id = auth.uid()
          )
        )
        or (
          p.audience_type = 'group'
          and p.audience_group_id is not null
          and (
            exists (
              select 1
              from public.internal_social_groups g
              where g.id = p.audience_group_id
                and g.is_private = false
            )
            or exists (
              select 1
              from public.internal_social_group_members gm
              where gm.group_id = p.audience_group_id
                and gm.user_id = auth.uid()
            )
          )
        )
        or public.current_role() in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_post_comments_insert_auth on public.internal_social_post_comments;
create policy internal_social_post_comments_insert_auth
on public.internal_social_post_comments
for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.internal_social_posts p
    where p.id = post_id
      and (
        p.audience_type = 'company'
        or (
          p.audience_type = 'project'
          and p.audience_project_id is not null
          and exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.audience_project_id
              and pm.user_id = auth.uid()
          )
        )
        or (
          p.audience_type = 'group'
          and p.audience_group_id is not null
          and (
            exists (
              select 1
              from public.internal_social_groups g
              where g.id = p.audience_group_id
                and g.is_private = false
            )
            or exists (
              select 1
              from public.internal_social_group_members gm
              where gm.group_id = p.audience_group_id
                and gm.user_id = auth.uid()
            )
          )
        )
        or public.current_role() in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_post_reactions_select_auth on public.internal_social_post_reactions;
create policy internal_social_post_reactions_select_auth
on public.internal_social_post_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.internal_social_posts p
    where p.id = post_id
      and (
        p.audience_type = 'company'
        or (
          p.audience_type = 'project'
          and p.audience_project_id is not null
          and exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.audience_project_id
              and pm.user_id = auth.uid()
          )
        )
        or (
          p.audience_type = 'group'
          and p.audience_group_id is not null
          and (
            exists (
              select 1
              from public.internal_social_groups g
              where g.id = p.audience_group_id
                and g.is_private = false
            )
            or exists (
              select 1
              from public.internal_social_group_members gm
              where gm.group_id = p.audience_group_id
                and gm.user_id = auth.uid()
            )
          )
        )
        or public.current_role() in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_post_reactions_insert_auth on public.internal_social_post_reactions;
create policy internal_social_post_reactions_insert_auth
on public.internal_social_post_reactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.internal_social_posts p
    where p.id = post_id
      and (
        p.audience_type = 'company'
        or (
          p.audience_type = 'project'
          and p.audience_project_id is not null
          and exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.audience_project_id
              and pm.user_id = auth.uid()
          )
        )
        or (
          p.audience_type = 'group'
          and p.audience_group_id is not null
          and (
            exists (
              select 1
              from public.internal_social_groups g
              where g.id = p.audience_group_id
                and g.is_private = false
            )
            or exists (
              select 1
              from public.internal_social_group_members gm
              where gm.group_id = p.audience_group_id
                and gm.user_id = auth.uid()
            )
          )
        )
        or public.current_role() in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_polls_select_auth on public.internal_social_polls;
create policy internal_social_polls_select_auth
on public.internal_social_polls
for select
to authenticated
using (
  exists (
    select 1
    from public.internal_social_posts p
    where p.id = post_id
      and (
        p.audience_type = 'company'
        or (
          p.audience_type = 'project'
          and p.audience_project_id is not null
          and exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.audience_project_id
              and pm.user_id = auth.uid()
          )
        )
        or (
          p.audience_type = 'group'
          and p.audience_group_id is not null
          and (
            exists (
              select 1
              from public.internal_social_groups g
              where g.id = p.audience_group_id
                and g.is_private = false
            )
            or exists (
              select 1
              from public.internal_social_group_members gm
              where gm.group_id = p.audience_group_id
                and gm.user_id = auth.uid()
            )
          )
        )
        or public.current_role() in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_polls_insert_auth on public.internal_social_polls;
create policy internal_social_polls_insert_auth
on public.internal_social_polls
for insert
to authenticated
with check (
  exists (
    select 1
    from public.internal_social_posts p
    where p.id = post_id
      and p.author_user_id = auth.uid()
  )
);

drop policy if exists internal_social_poll_options_select_auth on public.internal_social_poll_options;
create policy internal_social_poll_options_select_auth
on public.internal_social_poll_options
for select
to authenticated
using (
  exists (
    select 1
    from public.internal_social_polls poll
    join public.internal_social_posts p on p.id = poll.post_id
    where poll.id = poll_id
      and (
        p.audience_type = 'company'
        or (
          p.audience_type = 'project'
          and p.audience_project_id is not null
          and exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.audience_project_id
              and pm.user_id = auth.uid()
          )
        )
        or (
          p.audience_type = 'group'
          and p.audience_group_id is not null
          and (
            exists (
              select 1
              from public.internal_social_groups g
              where g.id = p.audience_group_id
                and g.is_private = false
            )
            or exists (
              select 1
              from public.internal_social_group_members gm
              where gm.group_id = p.audience_group_id
                and gm.user_id = auth.uid()
            )
          )
        )
        or public.current_role() in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_poll_options_insert_auth on public.internal_social_poll_options;
create policy internal_social_poll_options_insert_auth
on public.internal_social_poll_options
for insert
to authenticated
with check (
  exists (
    select 1
    from public.internal_social_polls poll
    join public.internal_social_posts p on p.id = poll.post_id
    where poll.id = poll_id
      and p.author_user_id = auth.uid()
  )
);

drop policy if exists internal_social_poll_votes_select_auth on public.internal_social_poll_votes;
create policy internal_social_poll_votes_select_auth
on public.internal_social_poll_votes
for select
to authenticated
using (true);

drop policy if exists internal_social_poll_votes_insert_auth on public.internal_social_poll_votes;
create policy internal_social_poll_votes_insert_auth
on public.internal_social_poll_votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.internal_social_polls poll
    join public.internal_social_posts p on p.id = poll.post_id
    where poll.id = internal_social_poll_votes.poll_id
      and (
        p.audience_type = 'company'
        or (
          p.audience_type = 'project'
          and p.audience_project_id is not null
          and exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.audience_project_id
              and pm.user_id = auth.uid()
          )
        )
        or (
          p.audience_type = 'group'
          and p.audience_group_id is not null
          and (
            exists (
              select 1
              from public.internal_social_groups g
              where g.id = p.audience_group_id
                and g.is_private = false
            )
            or exists (
              select 1
              from public.internal_social_group_members gm
              where gm.group_id = p.audience_group_id
                and gm.user_id = auth.uid()
            )
          )
        )
        or public.current_role() in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_poll_votes_delete_own on public.internal_social_poll_votes;
create policy internal_social_poll_votes_delete_own
on public.internal_social_poll_votes
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists internal_social_reports_select_auth on public.internal_social_reports;
create policy internal_social_reports_select_auth
on public.internal_social_reports
for select
to authenticated
using (
  reporter_user_id = auth.uid()
  or public.current_role() in ('admin', 'diretoria', 'rh')
);

drop policy if exists internal_social_reports_insert_auth on public.internal_social_reports;
create policy internal_social_reports_insert_auth
on public.internal_social_reports
for insert
to authenticated
with check (reporter_user_id = auth.uid());

drop policy if exists internal_social_reports_update_moderator on public.internal_social_reports;
create policy internal_social_reports_update_moderator
on public.internal_social_reports
for update
to authenticated
using (public.current_role() in ('admin', 'diretoria', 'rh'))
with check (public.current_role() in ('admin', 'diretoria', 'rh'));

drop policy if exists internal_social_moderation_actions_select_auth on public.internal_social_moderation_actions;
create policy internal_social_moderation_actions_select_auth
on public.internal_social_moderation_actions
for select
to authenticated
using (public.current_role() in ('admin', 'diretoria', 'rh'));

drop policy if exists internal_social_moderation_actions_insert_auth on public.internal_social_moderation_actions;
create policy internal_social_moderation_actions_insert_auth
on public.internal_social_moderation_actions
for insert
to authenticated
with check (
  moderator_user_id = auth.uid()
  and public.current_role() in ('admin', 'diretoria', 'rh')
);

insert into public.internal_social_groups (name, slug, description, cover_color, is_private)
select 'Comunicacao Interna', 'comunicacao-interna', 'Canal oficial para comunicados e campanhas internas.', '#0f172a', false
where not exists (
  select 1 from public.internal_social_groups where slug = 'comunicacao-interna'
);

insert into public.internal_social_groups (name, slug, description, cover_color, is_private)
select 'Cultura e Pessoas', 'cultura-e-pessoas', 'Espaco para onboarding, reconhecimento e iniciativas de cultura.', '#14532d', false
where not exists (
  select 1 from public.internal_social_groups where slug = 'cultura-e-pessoas'
);

commit;
