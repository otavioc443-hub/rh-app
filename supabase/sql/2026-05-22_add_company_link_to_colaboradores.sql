-- Estrutura o vinculo do colaborador com a empresa selecionada pelo RH.
-- Mantem compatibilidade com o campo legado colaboradores.empresa.

alter table if exists public.colaboradores
  add column if not exists company_id uuid references public.companies(id) on delete set null;

alter table if exists public.colaboradores
  add column if not exists department_id uuid references public.departments(id) on delete set null;

update public.colaboradores c
set company_id = co.id
from public.companies co
where c.company_id is null
  and nullif(trim(c.empresa), '') is not null
  and lower(trim(c.empresa)) = lower(trim(co.name));

create index if not exists colaboradores_company_id_idx
  on public.colaboradores(company_id);

create index if not exists colaboradores_department_id_idx
  on public.colaboradores(department_id);

create index if not exists colaboradores_user_id_idx
  on public.colaboradores(user_id);
