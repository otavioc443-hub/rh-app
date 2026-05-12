begin;

create table if not exists public.pulsehub_bolao_copa_2026 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  nome text,
  email text,
  jogadores jsonb not null,
  jogadores_manuais jsonb,
  total_jogadores int not null,
  status text default 'enviado',
  created_at timestamptz default now(),
  constraint pulsehub_bolao_copa_2026_unique_user unique (user_id),
  constraint pulsehub_bolao_copa_2026_total_26 check (total_jogadores = 26),
  constraint pulsehub_bolao_copa_2026_status_check check (status in ('enviado'))
);

create table if not exists public.pulsehub_bolao_config (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  valor numeric,
  regulamento text,
  prazo timestamptz,
  pix_link text,
  qr_code_url text,
  status text default 'ativo',
  updated_at timestamptz default now(),
  constraint pulsehub_bolao_config_status_check check (status in ('ativo', 'encerrado'))
);

insert into public.pulsehub_bolao_config (
  titulo,
  valor,
  regulamento,
  prazo,
  pix_link,
  qr_code_url,
  status
)
select
  'Bolão Copa do Mundo 2026',
  20.00,
  'Apenas quem acertar os 26 nomes convocados ganhará o prêmio, considerando o valor acumulado.
Caso tenha mais de um ganhador, o prêmio será dividido igualmente entre eles.
Caso não haja ganhadores, o valor será guardado para a Festa de São João 2026.
Caso o apostador acredite que um jogador fora da lista será convocado, deverá ter a opção de incluir manualmente um nome.
Caso o apostador não escolha exatamente 26 jogadores, estará desclassificado.
O prazo final para envio da lista com os 26 nomes é 17/05/2026 às 23h59.',
  '2026-05-18 02:59:00+00'::timestamptz,
  '',
  '',
  'ativo'
where not exists (select 1 from public.pulsehub_bolao_config);

create index if not exists idx_pulsehub_bolao_copa_2026_created_at
  on public.pulsehub_bolao_copa_2026(created_at desc);

create index if not exists idx_pulsehub_bolao_copa_2026_email
  on public.pulsehub_bolao_copa_2026(email);

create or replace function public.pulsehub_bolao_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pulsehub_bolao_config_updated_at on public.pulsehub_bolao_config;
create trigger trg_pulsehub_bolao_config_updated_at
before update on public.pulsehub_bolao_config
for each row execute function public.pulsehub_bolao_touch_updated_at();

create or replace function public.pulsehub_bolao_is_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pulsehub_bolao_config c
    where coalesce(c.status, 'ativo') = 'ativo'
      and coalesce(c.prazo, '2026-05-18 02:59:00+00'::timestamptz) >= now()
    order by c.updated_at desc
    limit 1
  )
$$;

alter table public.pulsehub_bolao_copa_2026 enable row level security;
alter table public.pulsehub_bolao_config enable row level security;

drop policy if exists pulsehub_bolao_config_select_auth on public.pulsehub_bolao_config;
create policy pulsehub_bolao_config_select_auth
on public.pulsehub_bolao_config
for select
to authenticated
using (true);

drop policy if exists pulsehub_bolao_config_insert_rh_admin on public.pulsehub_bolao_config;
create policy pulsehub_bolao_config_insert_rh_admin
on public.pulsehub_bolao_config
for insert
to authenticated
with check (public.current_active() = true and public.current_role() in ('rh', 'admin'));

drop policy if exists pulsehub_bolao_config_update_rh_admin on public.pulsehub_bolao_config;
create policy pulsehub_bolao_config_update_rh_admin
on public.pulsehub_bolao_config
for update
to authenticated
using (public.current_active() = true and public.current_role() in ('rh', 'admin'))
with check (public.current_active() = true and public.current_role() in ('rh', 'admin'));

drop policy if exists pulsehub_bolao_select_own_or_rh_admin on public.pulsehub_bolao_copa_2026;
create policy pulsehub_bolao_select_own_or_rh_admin
on public.pulsehub_bolao_copa_2026
for select
to authenticated
using (
  user_id = auth.uid()
  or (public.current_active() = true and public.current_role() in ('rh', 'admin'))
);

drop policy if exists pulsehub_bolao_insert_own_open on public.pulsehub_bolao_copa_2026;
create policy pulsehub_bolao_insert_own_open
on public.pulsehub_bolao_copa_2026
for insert
to authenticated
with check (
  user_id = auth.uid()
  and total_jogadores = 26
  and public.pulsehub_bolao_is_open()
);

insert into storage.buckets (id, name, public)
select 'pulsehub-bolao', 'pulsehub-bolao', true
where not exists (
  select 1
  from storage.buckets b
  where b.id = 'pulsehub-bolao'
     or b.name = 'pulsehub-bolao'
);

update storage.buckets
set
  public = true,
  file_size_limit = 3145728,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'pulsehub-bolao';

drop policy if exists "Public read pulsehub bolao QR" on storage.objects;
create policy "Public read pulsehub bolao QR"
on storage.objects
for select
to authenticated
using (bucket_id = 'pulsehub-bolao');

drop policy if exists "RH/Admin upload pulsehub bolao QR" on storage.objects;
create policy "RH/Admin upload pulsehub bolao QR"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pulsehub-bolao'
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
);

drop policy if exists "RH/Admin update pulsehub bolao QR" on storage.objects;
create policy "RH/Admin update pulsehub bolao QR"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'pulsehub-bolao'
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
)
with check (
  bucket_id = 'pulsehub-bolao'
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
);

drop policy if exists "RH/Admin delete pulsehub bolao QR" on storage.objects;
create policy "RH/Admin delete pulsehub bolao QR"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pulsehub-bolao'
  and public.current_active() = true
  and public.current_role() in ('rh', 'admin')
);

grant execute on function public.pulsehub_bolao_is_open() to authenticated;

commit;
