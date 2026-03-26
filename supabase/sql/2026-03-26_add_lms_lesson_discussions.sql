begin;

create table if not exists public.lms_lesson_discussions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  lesson_id uuid not null references public.lms_lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lms_lesson_discussions_lesson_created
  on public.lms_lesson_discussions(lesson_id, created_at desc);

create index if not exists idx_lms_lesson_discussions_user
  on public.lms_lesson_discussions(user_id, created_at desc);

alter table public.lms_lesson_discussions enable row level security;

drop policy if exists lms_lesson_discussions_select on public.lms_lesson_discussions;
create policy lms_lesson_discussions_select
on public.lms_lesson_discussions
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','rh')
  )
  or exists (
    select 1
    from public.lms_user_course_visibility v
    where v.user_id = auth.uid()
      and v.course_id = lms_lesson_discussions.course_id
  )
);

drop policy if exists lms_lesson_discussions_insert on public.lms_lesson_discussions;
create policy lms_lesson_discussions_insert
on public.lms_lesson_discussions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin','rh')
    )
    or exists (
      select 1
      from public.lms_user_course_visibility v
      where v.user_id = auth.uid()
        and v.course_id = lms_lesson_discussions.course_id
    )
  )
);

commit;
