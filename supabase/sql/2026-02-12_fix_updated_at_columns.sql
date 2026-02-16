-- Corrige tabelas com trigger set_updated_at() sem coluna updated_at.
-- Seguro para reexecucao.

begin;

alter table if exists public.profiles
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.colaboradores
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.absence_allowances
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.absence_requests
  add column if not exists updated_at timestamptz not null default now();

commit;
