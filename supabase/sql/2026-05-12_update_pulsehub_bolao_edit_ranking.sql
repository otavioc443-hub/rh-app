begin;

alter table public.pulsehub_bolao_copa_2026
  add column if not exists setor text,
  add column if not exists updated_at timestamptz default now();

alter table public.pulsehub_bolao_config
  add column if not exists jogadores_convocados jsonb,
  add column if not exists resultado_confirmado_at timestamptz;

create or replace function public.pulsehub_bolao_touch_bet_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pulsehub_bolao_copa_2026_updated_at on public.pulsehub_bolao_copa_2026;
create trigger trg_pulsehub_bolao_copa_2026_updated_at
before update on public.pulsehub_bolao_copa_2026
for each row execute function public.pulsehub_bolao_touch_bet_updated_at();

drop policy if exists pulsehub_bolao_select_own_or_rh_admin on public.pulsehub_bolao_copa_2026;
drop policy if exists pulsehub_bolao_select_all_authenticated on public.pulsehub_bolao_copa_2026;
create policy pulsehub_bolao_select_all_authenticated
on public.pulsehub_bolao_copa_2026
for select
to authenticated
using (true);

drop policy if exists pulsehub_bolao_update_own_open on public.pulsehub_bolao_copa_2026;
create policy pulsehub_bolao_update_own_open
on public.pulsehub_bolao_copa_2026
for update
to authenticated
using (
  user_id = auth.uid()
  and public.pulsehub_bolao_is_open()
)
with check (
  user_id = auth.uid()
  and total_jogadores = 26
  and public.pulsehub_bolao_is_open()
);

commit;
