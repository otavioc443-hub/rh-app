-- Criacao de estrutura inicial para PDI do colaborador

begin;

create table if not exists public.pdi_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  action text null,
  target_date date null,
  status text not null default 'planejado' check (status in ('planejado', 'em_andamento', 'concluido')),
  created_at timestamptz not null default now()
);

alter table public.pdi_items enable row level security;

drop policy if exists pdi_items_select_own on public.pdi_items;
create policy pdi_items_select_own
on public.pdi_items
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists pdi_items_insert_own on public.pdi_items;
create policy pdi_items_insert_own
on public.pdi_items
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists pdi_items_update_own on public.pdi_items;
create policy pdi_items_update_own
on public.pdi_items
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists pdi_items_delete_own on public.pdi_items;
create policy pdi_items_delete_own
on public.pdi_items
for delete
to authenticated
using (user_id = auth.uid());

create index if not exists idx_pdi_items_user_created
  on public.pdi_items(user_id, created_at desc);

commit;
