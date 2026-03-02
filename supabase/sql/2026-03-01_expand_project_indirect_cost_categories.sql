begin;

alter table if exists public.project_indirect_costs
  drop constraint if exists project_indirect_costs_cost_category_check;

alter table if exists public.project_indirect_costs
  add constraint project_indirect_costs_cost_category_check
  check (
    cost_category in (
      'rh',
      'financeiro',
      'adm',
      'ti',
      'juridico',
      'utilidades',
      'tributos',
      'infraestrutura',
      'outros'
    )
  );

commit;
