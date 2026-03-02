begin;

alter table if exists public.project_deliverables
  add column if not exists discipline_code text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_project_deliverables_discipline_code'
  ) then
    alter table public.project_deliverables
      add constraint ck_project_deliverables_discipline_code
      check (discipline_code is null or discipline_code in ('civil', 'eletromecanico'));
  end if;
end $$;

commit;

