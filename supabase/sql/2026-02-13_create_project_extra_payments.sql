begin;

-- Solicitações de pagamento de valores extras por projeto (Gestor -> Financeiro/RH/Admin).
create table if not exists public.project_extra_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  -- colaborador que receberá o valor (auth user)
  user_id uuid not null references auth.users(id) on delete restrict,

  amount numeric(12,2) not null check (amount > 0),
  reference_month date not null,
  description text null,

  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),

  requested_by uuid not null references auth.users(id) on delete restrict,
  finance_note text null,
  decided_by uuid null references auth.users(id) on delete set null,
  decided_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_extra_payments_project on public.project_extra_payments(project_id);
create index if not exists idx_project_extra_payments_status on public.project_extra_payments(status);
create index if not exists idx_project_extra_payments_ref_month on public.project_extra_payments(reference_month);
create index if not exists idx_project_extra_payments_user on public.project_extra_payments(user_id);

drop trigger if exists trg_project_extra_payments_updated_at on public.project_extra_payments;
create trigger trg_project_extra_payments_updated_at
before update on public.project_extra_payments
for each row execute function public.set_updated_at();

alter table public.project_extra_payments enable row level security;

-- Select: gestor/coordenador do projeto, dono do projeto, solicitante, próprio usuário, ou RH/Admin (financeiro).
drop policy if exists project_extra_payments_select on public.project_extra_payments;
create policy project_extra_payments_select
on public.project_extra_payments
for select
to authenticated
using (
  requested_by = auth.uid()
  or user_id = auth.uid()
  or exists (
    select 1
    from public.projects pr
    where pr.id = project_extra_payments.project_id
      and pr.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_extra_payments.project_id
      and pm.user_id = auth.uid()
      and pm.member_role in ('gestor', 'coordenador')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
);

-- Insert: apenas gestor/coordenador do projeto (ou dono) / RH/Admin.
-- Também garante que o user_id é membro do projeto.
drop policy if exists project_extra_payments_insert_manager on public.project_extra_payments;
create policy project_extra_payments_insert_manager
on public.project_extra_payments
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and exists (
    select 1
    from public.project_members m
    where m.project_id = project_extra_payments.project_id
      and m.user_id = project_extra_payments.user_id
  )
  and (
    exists (
      select 1
      from public.projects pr
      where pr.id = project_extra_payments.project_id
        and pr.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_extra_payments.project_id
        and pm.user_id = auth.uid()
        and pm.member_role in ('gestor', 'coordenador')
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.role in ('admin', 'rh')
    )
  )
);

-- Update: RH/Admin podem decidir/pagar; solicitante pode editar enquanto pendente.
drop policy if exists project_extra_payments_update on public.project_extra_payments;
create policy project_extra_payments_update
on public.project_extra_payments
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
  or (requested_by = auth.uid() and status = 'pending')
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
  or (requested_by = auth.uid() and status = 'pending')
);

-- Delete: solicitante pode cancelar enquanto pendente; RH/Admin também.
drop policy if exists project_extra_payments_delete on public.project_extra_payments;
create policy project_extra_payments_delete
on public.project_extra_payments
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'rh')
  )
  or (requested_by = auth.uid() and status = 'pending')
);

commit;

