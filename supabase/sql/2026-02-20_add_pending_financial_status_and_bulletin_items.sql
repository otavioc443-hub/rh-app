begin;

-- 1) Amplia status financeiro do entregavel para: aberto / pendente / baixado
alter table if exists public.project_deliverables
  drop constraint if exists ck_project_deliverables_financial_status;

alter table if exists public.project_deliverables
  add constraint ck_project_deliverables_financial_status
  check (financial_status in ('aberto', 'pendente', 'baixado'));

-- 2) Vinculo entre boletim e entregaveis selecionados no momento da geracao
create table if not exists public.project_measurement_bulletin_items (
  id uuid primary key default gen_random_uuid(),
  bulletin_id uuid not null references public.project_measurement_bulletins(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  deliverable_id uuid not null references public.project_deliverables(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bulletin_id, deliverable_id)
);

create index if not exists idx_project_measurement_bulletin_items_bulletin
  on public.project_measurement_bulletin_items(bulletin_id, created_at desc);

create index if not exists idx_project_measurement_bulletin_items_deliverable
  on public.project_measurement_bulletin_items(project_id, deliverable_id);

alter table public.project_measurement_bulletin_items enable row level security;

drop policy if exists project_measurement_bulletin_items_select on public.project_measurement_bulletin_items;
create policy project_measurement_bulletin_items_select
on public.project_measurement_bulletin_items
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'financeiro', 'rh', 'diretoria')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_measurement_bulletin_items.project_id
        and pm.user_id = auth.uid()
    )
  )
);

drop policy if exists project_measurement_bulletin_items_insert on public.project_measurement_bulletin_items;
create policy project_measurement_bulletin_items_insert
on public.project_measurement_bulletin_items
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro', 'diretoria')
);

drop policy if exists project_measurement_bulletin_items_delete on public.project_measurement_bulletin_items;
create policy project_measurement_bulletin_items_delete
on public.project_measurement_bulletin_items
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('admin', 'financeiro', 'diretoria')
);

commit;
