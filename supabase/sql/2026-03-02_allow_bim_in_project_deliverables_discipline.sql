begin;

alter table if exists public.project_deliverables
  drop constraint if exists ck_project_deliverables_discipline_code;

alter table if exists public.project_deliverables
  add constraint ck_project_deliverables_discipline_code
  check (discipline_code is null or discipline_code in ('civil', 'bim', 'eletromecanico'));

commit;
