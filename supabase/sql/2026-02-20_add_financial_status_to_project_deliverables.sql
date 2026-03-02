begin;

alter table if exists public.project_deliverables
  add column if not exists financial_status text not null default 'aberto';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_project_deliverables_financial_status'
  ) then
    alter table public.project_deliverables
      add constraint ck_project_deliverables_financial_status
      check (financial_status in ('aberto', 'baixado'));
  end if;
end $$;

create index if not exists idx_project_deliverables_financial_status
  on public.project_deliverables(project_id, financial_status);

commit;
