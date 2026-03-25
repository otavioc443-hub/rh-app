begin;

create extension if not exists pgcrypto;

create table if not exists public.lms_courses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  title text not null,
  slug text not null unique,
  short_description text null,
  full_description text null,
  category text null,
  thumbnail_url text null,
  banner_url text null,
  workload_hours numeric(10,2) null,
  required boolean not null default false,
  certificate_enabled boolean not null default true,
  passing_score integer null default 70 check (passing_score is null or (passing_score between 0 and 100)),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  visibility text not null default 'publico_interno' check (visibility in ('publico_interno','restrito')),
  sequence_required boolean not null default true,
  onboarding_recommended boolean not null default false,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  title text not null,
  description text null,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.lms_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  module_id uuid not null references public.lms_course_modules(id) on delete cascade,
  title text not null,
  description text null,
  lesson_type text not null check (lesson_type in ('video','pdf','arquivo','link','texto','avaliacao')),
  content_url text null,
  content_text text null,
  duration_minutes integer null,
  sort_order integer not null default 1,
  is_required boolean not null default true,
  allow_preview boolean not null default false,
  storage_bucket text null,
  storage_path text null,
  created_at timestamptz not null default now()
);

create table if not exists public.lms_learning_paths (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  title text not null,
  description text null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  onboarding_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_learning_path_courses (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid not null references public.lms_learning_paths(id) on delete cascade,
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  sort_order integer not null default 1,
  required boolean not null default true,
  unique (learning_path_id, course_id)
);

create table if not exists public.lms_assignments (
  id uuid primary key default gen_random_uuid(),
  assignment_type text not null check (assignment_type in ('user','department','company','role','learning_path')),
  target_id text not null,
  course_id uuid null references public.lms_courses(id) on delete cascade,
  learning_path_id uuid null references public.lms_learning_paths(id) on delete cascade,
  assigned_by uuid null references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  due_date date null,
  mandatory boolean not null default true,
  status text not null default 'active' check (status in ('active','paused','expired','cancelled')),
  expires_at date null,
  check ((course_id is not null) or (learning_path_id is not null))
);

create table if not exists public.lms_user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed','overdue')),
  progress_percent numeric(5,2) not null default 0,
  completed_lessons integer not null default 0,
  required_lessons integer not null default 0,
  passed_quiz boolean not null default false,
  started_at timestamptz null,
  completed_at timestamptz null,
  last_lesson_id uuid null references public.lms_lessons(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.lms_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lms_lessons(id) on delete cascade,
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz null,
  time_spent_minutes integer not null default 0,
  last_accessed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.lms_quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid null references public.lms_courses(id) on delete cascade,
  lesson_id uuid null references public.lms_lessons(id) on delete cascade,
  title text not null,
  passing_score integer not null default 70 check (passing_score between 0 and 100),
  max_attempts integer null,
  randomize_questions boolean not null default false,
  created_at timestamptz not null default now(),
  check ((course_id is not null) or (lesson_id is not null))
);

create table if not exists public.lms_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.lms_quizzes(id) on delete cascade,
  statement text not null,
  question_type text not null check (question_type in ('single_choice','multiple_choice','true_false')),
  sort_order integer not null default 1
);

create table if not exists public.lms_quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.lms_quiz_questions(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false
);

create table if not exists public.lms_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.lms_quizzes(id) on delete cascade,
  course_id uuid null references public.lms_courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score numeric(5,2) not null default 0,
  passed boolean not null default false,
  attempt_number integer not null default 1,
  submitted_at timestamptz not null default now()
);

create table if not exists public.lms_quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.lms_quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.lms_quiz_questions(id) on delete cascade,
  option_id uuid null references public.lms_quiz_options(id) on delete set null,
  answer_text text null,
  is_correct boolean not null default false
);

create table if not exists public.lms_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  validation_code text not null unique,
  file_url text null,
  issued_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.lms_course_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  lesson_id uuid null references public.lms_lessons(id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);

create view public.lms_user_course_visibility as
select distinct
  p.id as user_id,
  coalesce(a.course_id, lpc.course_id) as course_id,
  a.id as assignment_id,
  a.assignment_type,
  a.learning_path_id,
  a.due_date,
  a.mandatory,
  a.assigned_at,
  a.expires_at
from public.profiles p
join public.lms_assignments a
  on (
    (a.assignment_type = 'user' and a.target_id = p.id::text)
    or (a.assignment_type = 'department' and a.target_id = coalesce(p.department_id::text, ''))
    or (a.assignment_type = 'company' and a.target_id = coalesce(p.company_id::text, ''))
    or (a.assignment_type = 'role' and a.target_id = coalesce(p.role, ''))
  )
left join public.lms_learning_path_courses lpc
  on lpc.learning_path_id = a.learning_path_id
where coalesce(p.active, true) = true
  and a.status = 'active'
  and (a.expires_at is null or a.expires_at >= current_date);

create view public.lms_dashboard_department_completion as
select
  p.company_id,
  p.department_id,
  d.name as department_name,
  round(coalesce(avg(up.progress_percent), 0), 2) as avg_completion
from public.lms_user_progress up
join public.profiles p on p.id = up.user_id
left join public.departments d on d.id = p.department_id
group by p.company_id, p.department_id, d.name;

create index if not exists idx_lms_courses_company_status on public.lms_courses(company_id, status);
create index if not exists idx_lms_courses_slug on public.lms_courses(slug);
create index if not exists idx_lms_modules_course on public.lms_course_modules(course_id, sort_order);
create index if not exists idx_lms_lessons_course on public.lms_lessons(course_id, module_id, sort_order);
create index if not exists idx_lms_paths_company on public.lms_learning_paths(company_id, status);
create index if not exists idx_lms_assignments_target on public.lms_assignments(assignment_type, target_id, status);
create index if not exists idx_lms_assignments_course on public.lms_assignments(course_id, learning_path_id);
create index if not exists idx_lms_progress_user_course on public.lms_user_progress(user_id, course_id);
create index if not exists idx_lms_lesson_progress_user_course on public.lms_lesson_progress(user_id, course_id);
create index if not exists idx_lms_quiz_attempts_user_quiz on public.lms_quiz_attempts(user_id, quiz_id, submitted_at desc);
create index if not exists idx_lms_certificates_user_course on public.lms_certificates(user_id, course_id);
create index if not exists idx_lms_access_logs_user_course on public.lms_course_access_logs(user_id, course_id, created_at desc);

insert into storage.buckets (id, name, public)
values
  ('lms-thumbnails', 'lms-thumbnails', false),
  ('lms-banners', 'lms-banners', false),
  ('lms-materials', 'lms-materials', false),
  ('lms-certificates', 'lms-certificates', false),
  ('lms-videos', 'lms-videos', false)
on conflict (id) do nothing;

alter table public.lms_courses enable row level security;
alter table public.lms_course_modules enable row level security;
alter table public.lms_lessons enable row level security;
alter table public.lms_learning_paths enable row level security;
alter table public.lms_learning_path_courses enable row level security;
alter table public.lms_assignments enable row level security;
alter table public.lms_user_progress enable row level security;
alter table public.lms_lesson_progress enable row level security;
alter table public.lms_quizzes enable row level security;
alter table public.lms_quiz_questions enable row level security;
alter table public.lms_quiz_options enable row level security;
alter table public.lms_quiz_attempts enable row level security;
alter table public.lms_quiz_answers enable row level security;
alter table public.lms_certificates enable row level security;
alter table public.lms_course_access_logs enable row level security;

drop policy if exists lms_courses_read on public.lms_courses;
create policy lms_courses_read on public.lms_courses for select to authenticated using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and (
        p.role in ('admin','rh','gestor','coordenador','colaborador','diretoria','compliance')
      )
      and (
        lms_courses.company_id is null
        or p.company_id is null
        or lms_courses.company_id = p.company_id
      )
  )
);

drop policy if exists lms_courses_manage on public.lms_courses;
create policy lms_courses_manage on public.lms_courses for all to authenticated using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and p.role in ('admin','rh')
      and (p.company_id is null or lms_courses.company_id is null or lms_courses.company_id = p.company_id)
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and p.role in ('admin','rh')
      and (p.company_id is null or lms_courses.company_id is null or lms_courses.company_id = p.company_id)
  )
);

drop policy if exists lms_modules_read on public.lms_course_modules;
create policy lms_modules_read on public.lms_course_modules for select to authenticated using (
  exists (select 1 from public.lms_courses c where c.id = lms_course_modules.course_id)
);

drop policy if exists lms_modules_manage on public.lms_course_modules;
create policy lms_modules_manage on public.lms_course_modules for all to authenticated using (
  exists (
    select 1 from public.profiles p
    join public.lms_courses c on c.id = lms_course_modules.course_id
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and (p.company_id is null or c.company_id is null or p.company_id = c.company_id)
  )
) with check (
  exists (
    select 1 from public.profiles p
    join public.lms_courses c on c.id = lms_course_modules.course_id
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and (p.company_id is null or c.company_id is null or p.company_id = c.company_id)
  )
);

drop policy if exists lms_lessons_read on public.lms_lessons;
create policy lms_lessons_read on public.lms_lessons for select to authenticated using (
  exists (select 1 from public.lms_courses c where c.id = lms_lessons.course_id)
);

drop policy if exists lms_lessons_manage on public.lms_lessons;
create policy lms_lessons_manage on public.lms_lessons for all to authenticated using (
  exists (
    select 1 from public.profiles p
    join public.lms_courses c on c.id = lms_lessons.course_id
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and (p.company_id is null or c.company_id is null or p.company_id = c.company_id)
  )
) with check (
  exists (
    select 1 from public.profiles p
    join public.lms_courses c on c.id = lms_lessons.course_id
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and (p.company_id is null or c.company_id is null or p.company_id = c.company_id)
  )
);

drop policy if exists lms_paths_manage on public.lms_learning_paths;
create policy lms_paths_manage on public.lms_learning_paths for all to authenticated using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and (p.company_id is null or lms_learning_paths.company_id is null or p.company_id = lms_learning_paths.company_id)
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and (p.company_id is null or lms_learning_paths.company_id is null or p.company_id = lms_learning_paths.company_id)
  )
);

drop policy if exists lms_paths_read on public.lms_learning_paths;
create policy lms_paths_read on public.lms_learning_paths for select to authenticated using (true);

drop policy if exists lms_path_courses_rw on public.lms_learning_path_courses;
create policy lms_path_courses_rw on public.lms_learning_path_courses for all to authenticated using (
  exists (
    select 1
    from public.profiles p
    join public.lms_learning_paths lp on lp.id = lms_learning_path_courses.learning_path_id
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and (p.company_id is null or lp.company_id is null or p.company_id = lp.company_id)
  )
) with check (
  exists (
    select 1
    from public.profiles p
    join public.lms_learning_paths lp on lp.id = lms_learning_path_courses.learning_path_id
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and (p.company_id is null or lp.company_id is null or p.company_id = lp.company_id)
  )
);

drop policy if exists lms_assignments_rw on public.lms_assignments;
create policy lms_assignments_rw on public.lms_assignments for all to authenticated using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and coalesce(p.active, true) = true
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','rh')
      and coalesce(p.active, true) = true
  )
);

drop policy if exists lms_progress_owner on public.lms_user_progress;
create policy lms_progress_owner on public.lms_user_progress for select to authenticated using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','rh')
  )
  or exists (
    select 1 from public.profiles p
    where p.id = lms_user_progress.user_id
      and p.manager_id = auth.uid()
  )
);

drop policy if exists lms_progress_write on public.lms_user_progress;
create policy lms_progress_write on public.lms_user_progress for insert to authenticated with check (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists lms_progress_update on public.lms_user_progress;
create policy lms_progress_update on public.lms_user_progress for update to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists lms_lesson_progress_owner on public.lms_lesson_progress;
create policy lms_lesson_progress_owner on public.lms_lesson_progress for all to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists lms_quiz_read on public.lms_quizzes;
create policy lms_quiz_read on public.lms_quizzes for select to authenticated using (true);
drop policy if exists lms_quiz_manage on public.lms_quizzes;
create policy lms_quiz_manage on public.lms_quizzes for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists lms_quiz_questions_read on public.lms_quiz_questions;
create policy lms_quiz_questions_read on public.lms_quiz_questions for select to authenticated using (true);
drop policy if exists lms_quiz_questions_manage on public.lms_quiz_questions;
create policy lms_quiz_questions_manage on public.lms_quiz_questions for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists lms_quiz_options_read on public.lms_quiz_options;
create policy lms_quiz_options_read on public.lms_quiz_options for select to authenticated using (true);
drop policy if exists lms_quiz_options_manage on public.lms_quiz_options;
create policy lms_quiz_options_manage on public.lms_quiz_options for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists lms_attempt_owner on public.lms_quiz_attempts;
create policy lms_attempt_owner on public.lms_quiz_attempts for all to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists lms_answers_owner on public.lms_quiz_answers;
create policy lms_answers_owner on public.lms_quiz_answers for all to authenticated using (
  exists (
    select 1 from public.lms_quiz_attempts a
    where a.id = lms_quiz_answers.attempt_id
      and (
        a.user_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
      )
  )
) with check (
  exists (
    select 1 from public.lms_quiz_attempts a
    where a.id = lms_quiz_answers.attempt_id
      and (
        a.user_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
      )
  )
);

drop policy if exists lms_certificate_owner on public.lms_certificates;
create policy lms_certificate_owner on public.lms_certificates for all to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists lms_access_logs_owner on public.lms_course_access_logs;
create policy lms_access_logs_owner on public.lms_course_access_logs for all to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
) with check (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','rh'))
);

drop policy if exists "lms storage privileged read" on storage.objects;
create policy "lms storage privileged read"
on storage.objects for select to authenticated
using (
  bucket_id in ('lms-thumbnails','lms-banners','lms-materials','lms-certificates','lms-videos')
);

drop policy if exists "lms storage privileged write" on storage.objects;
create policy "lms storage privileged write"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('lms-thumbnails','lms-banners','lms-materials','lms-certificates','lms-videos')
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','rh')
  )
);

commit;
