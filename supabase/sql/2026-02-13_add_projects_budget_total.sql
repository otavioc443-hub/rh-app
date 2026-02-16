begin;

-- Campo opcional para registrar o custo total planejado do projeto (orcamento).
-- Usado no painel Financeiro para comparar custo estimado x planejado.
alter table public.projects
  add column if not exists budget_total numeric(14,2) null;

commit;

