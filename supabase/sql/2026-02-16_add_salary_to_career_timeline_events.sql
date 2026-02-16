begin;

-- Salario anterior/novo para eventos de promocao e mudancas contratuais.
alter table if exists public.career_timeline_events
  add column if not exists from_salary numeric(12,2) null;

alter table if exists public.career_timeline_events
  add column if not exists to_salary numeric(12,2) null;

commit;

