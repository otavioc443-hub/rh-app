begin;

alter table if exists public.feedbacks
  add column if not exists one_on_one_notes text null;

alter table if exists public.feedbacks
  drop constraint if exists feedbacks_one_on_one_notes_len_check;

alter table if exists public.feedbacks
  add constraint feedbacks_one_on_one_notes_len_check
  check (one_on_one_notes is null or char_length(one_on_one_notes) <= 2000);

commit;

