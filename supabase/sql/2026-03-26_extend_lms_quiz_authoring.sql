begin;

alter table public.lms_quizzes
  add column if not exists instructions text null,
  add column if not exists show_score_on_submit boolean not null default true,
  add column if not exists show_correct_answers boolean not null default false;

alter table public.lms_quiz_questions
  add column if not exists help_text text null,
  add column if not exists image_url text null,
  add column if not exists accepted_answers text[] not null default '{}',
  add column if not exists requires_manual_review boolean not null default false;

alter table public.lms_quiz_options
  add column if not exists image_url text null;

alter table public.lms_quiz_questions
  drop constraint if exists lms_quiz_questions_question_type_check;

alter table public.lms_quiz_questions
  add constraint lms_quiz_questions_question_type_check
  check (question_type in ('single_choice','multiple_choice','true_false','short_text','essay','image_choice'));

create index if not exists idx_lms_quiz_questions_type
  on public.lms_quiz_questions(question_type);

commit;
