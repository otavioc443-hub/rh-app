begin;

alter table if exists public.project_deliverables
  add column if not exists currency_code text not null default 'BRL',
  add column if not exists budget_amount numeric(14,2) null,
  add column if not exists actual_amount numeric(14,2) null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_project_deliverables_currency_code'
  ) then
    alter table public.project_deliverables
      add constraint ck_project_deliverables_currency_code
      check (currency_code in ('BRL', 'USD', 'EUR'));
  end if;
end $$;

commit;

