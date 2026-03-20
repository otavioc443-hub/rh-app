begin;

create table if not exists public.pd_equipment_assets (
  id uuid primary key default gen_random_uuid(),
  equipment_name text not null,
  equipment_type text not null check (equipment_type in ('computer', 'monitor', 'keyboard', 'mouse', 'headset', 'other')),
  status text not null default 'available' check (status in ('available', 'allocated', 'maintenance', 'retired')),
  brand text null,
  serial_number text null,
  hostname text null,
  processor text null,
  ram text null,
  gpu text null,
  wifi_enabled boolean not null default false,
  ethernet_enabled boolean not null default true,
  disk text null,
  monitor_details text null,
  keyboard_details text null,
  mouse_details text null,
  headset_details text null,
  additional_info text null,
  current_holder_user_id uuid null references auth.users(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pd_equipment_assets_type on public.pd_equipment_assets(equipment_type, status, created_at desc);
create index if not exists idx_pd_equipment_assets_holder on public.pd_equipment_assets(current_holder_user_id, created_at desc);

drop trigger if exists trg_pd_equipment_assets_updated_at on public.pd_equipment_assets;
create trigger trg_pd_equipment_assets_updated_at
before update on public.pd_equipment_assets
for each row execute function public.set_updated_at();

create table if not exists public.pd_equipment_allocations (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.pd_equipment_assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  allocation_notes text null,
  returned_notes text null,
  allocated_by uuid null references auth.users(id) on delete set null,
  returned_by uuid null references auth.users(id) on delete set null,
  allocated_at timestamptz not null default now(),
  returned_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pd_equipment_allocations_equipment on public.pd_equipment_allocations(equipment_id, allocated_at desc);
create index if not exists idx_pd_equipment_allocations_user on public.pd_equipment_allocations(user_id, allocated_at desc);

create table if not exists public.pd_equipment_maintenance (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.pd_equipment_assets(id) on delete cascade,
  maintenance_type text not null default 'preventive' check (maintenance_type in ('preventive', 'corrective', 'upgrade', 'inspection', 'other')),
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  title text not null,
  details text null,
  provider text null,
  cost numeric(12,2) null,
  scheduled_for date null,
  performed_at timestamptz null,
  next_due_at date null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pd_equipment_maintenance_equipment on public.pd_equipment_maintenance(equipment_id, created_at desc);
create index if not exists idx_pd_equipment_maintenance_status on public.pd_equipment_maintenance(status, scheduled_for);

drop trigger if exists trg_pd_equipment_maintenance_updated_at on public.pd_equipment_maintenance;
create trigger trg_pd_equipment_maintenance_updated_at
before update on public.pd_equipment_maintenance
for each row execute function public.set_updated_at();

alter table public.pd_equipment_assets enable row level security;
alter table public.pd_equipment_allocations enable row level security;
alter table public.pd_equipment_maintenance enable row level security;

drop policy if exists pd_equipment_assets_select on public.pd_equipment_assets;
create policy pd_equipment_assets_select
on public.pd_equipment_assets
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
);

drop policy if exists pd_equipment_assets_insert on public.pd_equipment_assets;
create policy pd_equipment_assets_insert
on public.pd_equipment_assets
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
);

drop policy if exists pd_equipment_assets_update on public.pd_equipment_assets;
create policy pd_equipment_assets_update
on public.pd_equipment_assets
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
)
with check (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
);

drop policy if exists pd_equipment_assets_delete on public.pd_equipment_assets;
create policy pd_equipment_assets_delete
on public.pd_equipment_assets
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
);

drop policy if exists pd_equipment_allocations_select on public.pd_equipment_allocations;
create policy pd_equipment_allocations_select
on public.pd_equipment_allocations
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
);

drop policy if exists pd_equipment_allocations_insert on public.pd_equipment_allocations;
create policy pd_equipment_allocations_insert
on public.pd_equipment_allocations
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
);

drop policy if exists pd_equipment_allocations_update on public.pd_equipment_allocations;
create policy pd_equipment_allocations_update
on public.pd_equipment_allocations
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
)
with check (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
);

drop policy if exists pd_equipment_maintenance_select on public.pd_equipment_maintenance;
create policy pd_equipment_maintenance_select
on public.pd_equipment_maintenance
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
);

drop policy if exists pd_equipment_maintenance_insert on public.pd_equipment_maintenance;
create policy pd_equipment_maintenance_insert
on public.pd_equipment_maintenance
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
);

drop policy if exists pd_equipment_maintenance_update on public.pd_equipment_maintenance;
create policy pd_equipment_maintenance_update
on public.pd_equipment_maintenance
for update
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
)
with check (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
);

drop policy if exists pd_equipment_maintenance_delete on public.pd_equipment_maintenance;
create policy pd_equipment_maintenance_delete
on public.pd_equipment_maintenance
for delete
to authenticated
using (
  public.current_active() = true
  and public.current_role() in ('pd', 'admin')
);

commit;
