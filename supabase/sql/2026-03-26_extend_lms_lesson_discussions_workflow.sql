begin;

alter table public.lms_lesson_discussions
  add column if not exists status text not null default 'pending';

alter table public.lms_lesson_discussions
  add column if not exists admin_response text null;

alter table public.lms_lesson_discussions
  add column if not exists responded_at timestamptz null;

alter table public.lms_lesson_discussions
  add column if not exists resolved_at timestamptz null;

alter table public.lms_lesson_discussions
  add column if not exists resolved_by uuid null references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lms_lesson_discussions_status_check'
  ) then
    alter table public.lms_lesson_discussions
      add constraint lms_lesson_discussions_status_check
      check (status in ('pending','answered','resolved'));
  end if;
end $$;

create index if not exists idx_lms_lesson_discussions_status_created
  on public.lms_lesson_discussions(status, created_at desc);

drop policy if exists lms_lesson_discussions_update on public.lms_lesson_discussions;
create policy lms_lesson_discussions_update
on public.lms_lesson_discussions
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and (
        p.company_id is null
        or lms_lesson_discussions.company_id is null
        or p.company_id = lms_lesson_discussions.company_id
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and (
        p.company_id is null
        or lms_lesson_discussions.company_id is null
        or p.company_id = lms_lesson_discussions.company_id
      )
  )
);

commit;
