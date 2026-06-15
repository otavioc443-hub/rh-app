begin;

alter table if exists public.colaboradores
  add column if not exists bonus_mensal numeric(12,2) null default 0;

comment on column public.colaboradores.bonus_mensal is
  'Valor de bonus mensal recorrente somado ao salario para calculos de folha mensal.';

commit;
