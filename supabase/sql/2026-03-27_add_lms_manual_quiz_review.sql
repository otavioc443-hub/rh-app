begin;

alter table public.lms_quiz_attempts
  add column if not exists review_status text not null default 'auto_graded',
  add column if not exists reviewer_comment text null,
  add column if not exists reviewed_score numeric(5,2) null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists reviewed_by uuid null references public.profiles(id) on delete set null;

alter table public.lms_quiz_attempts
  drop constraint if exists lms_quiz_attempts_review_status_check;

alter table public.lms_quiz_attempts
  add constraint lms_quiz_attempts_review_status_check
  check (review_status in ('pending_review','reviewed','auto_graded'));

create index if not exists idx_lms_quiz_attempts_review_status
  on public.lms_quiz_attempts(review_status, submitted_at desc);

commit;
