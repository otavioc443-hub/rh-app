begin;

create table if not exists public.lms_course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  version_label text not null,
  status text not null,
  snapshot_source text not null check (snapshot_source in ('create','update','publish','archive')),
  payload_json jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lms_course_versions_course_created
  on public.lms_course_versions(course_id, created_at desc);

alter table public.lms_course_versions enable row level security;

drop policy if exists lms_course_versions_read on public.lms_course_versions;
create policy lms_course_versions_read
on public.lms_course_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.lms_courses c on c.id = lms_course_versions.course_id
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and p.role in ('admin','rh')
      and (
        p.company_id is null
        or c.company_id is null
        or p.company_id = c.company_id
      )
  )
);

drop policy if exists lms_course_versions_insert on public.lms_course_versions;
create policy lms_course_versions_insert
on public.lms_course_versions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    join public.lms_courses c on c.id = lms_course_versions.course_id
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and p.role in ('admin','rh')
      and (
        p.company_id is null
        or c.company_id is null
        or p.company_id = c.company_id
      )
  )
);

commit;
