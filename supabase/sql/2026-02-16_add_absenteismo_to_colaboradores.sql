begin;

-- Campos para registro manual de absenteismo no cadastro do colaborador.
alter table if exists public.colaboradores
  add column if not exists absenteismo_percent numeric(5,2) null;

alter table if exists public.colaboradores
  add column if not exists absenteismo_notes text null;

commit;

