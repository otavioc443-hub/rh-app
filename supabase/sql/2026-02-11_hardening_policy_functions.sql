-- Hardening de funcoes usadas em policies
-- Objetivo: reduzir risco de search_path hijacking e garantir execucao consistente.

begin;

alter function public.current_role()
  security definer
  set search_path = public, pg_temp;

alter function public.is_rh_or_admin()
  security definer
  set search_path = public, pg_temp;

commit;
