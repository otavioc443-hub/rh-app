begin;

alter table public.pulsehub_bolao_copa_2026
  add column if not exists payment_status text not null default 'pendente',
  add column if not exists comprovante_url text,
  add column if not exists comprovante_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pulsehub_bolao_copa_2026_payment_status_check'
  ) then
    alter table public.pulsehub_bolao_copa_2026
      add constraint pulsehub_bolao_copa_2026_payment_status_check
      check (payment_status in ('pendente', 'aguardando_validacao', 'pago', 'recusado'));
  end if;
end $$;

drop policy if exists pulsehub_bolao_update_payment_rh_admin on public.pulsehub_bolao_copa_2026;
create policy pulsehub_bolao_update_payment_rh_admin
on public.pulsehub_bolao_copa_2026
for update
to authenticated
using (public.current_active() = true and public.current_role() in ('rh', 'admin'))
with check (public.current_active() = true and public.current_role() in ('rh', 'admin'));

create or replace function public.pulsehub_bolao_guard_payment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and auth.uid() = old.user_id
     and not (public.current_active() = true and public.current_role() in ('rh', 'admin')) then
    new.payment_status := old.payment_status;
    new.comprovante_url := old.comprovante_url;
    new.comprovante_path := old.comprovante_path;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pulsehub_bolao_guard_payment_fields on public.pulsehub_bolao_copa_2026;
create trigger trg_pulsehub_bolao_guard_payment_fields
before update on public.pulsehub_bolao_copa_2026
for each row execute function public.pulsehub_bolao_guard_payment_fields();

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
where id = 'pulsehub-bolao';

commit;
