-- Anexos + auditoria para solicitacoes de pagamentos extras (Gestor -> Financeiro).
-- - project_extra_payment_attachments: comprovantes (PDF/imagem)
-- - project_extra_payments_audit: trilha de auditoria (insert/update/delete)

begin;

create table if not exists public.project_extra_payment_attachments (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.project_extra_payments(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  file_url text not null,
  file_path text not null,
  file_name text null,
  mime_type text null,
  file_size bigint null,

  uploaded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_extra_payment_attachments_payment on public.project_extra_payment_attachments(payment_id);
create index if not exists idx_extra_payment_attachments_project on public.project_extra_payment_attachments(project_id);

alter table public.project_extra_payment_attachments enable row level security;

-- Select: quem pode ver a solicitacao tambem pode ver anexos (RLS herdada via EXISTS no payment).
drop policy if exists extra_payment_attachments_select_via_payment on public.project_extra_payment_attachments;
create policy extra_payment_attachments_select_via_payment
on public.project_extra_payment_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.project_extra_payments p
    where p.id = project_extra_payment_attachments.payment_id
  )
);

-- Insert/Update/Delete: liberado para o solicitante (requested_by) ou RH/Admin/Financeiro.
-- Observacao: o app faz upload via endpoint server com service role; esta policy e apenas para compatibilidade.
drop policy if exists extra_payment_attachments_write_allowed on public.project_extra_payment_attachments;
create policy extra_payment_attachments_write_allowed
on public.project_extra_payment_attachments
for all
to authenticated
using (
  exists (
    select 1
    from public.project_extra_payments p
    where p.id = project_extra_payment_attachments.payment_id
      and (
        p.requested_by = auth.uid()
        or public.current_role() in ('admin','rh','financeiro')
      )
  )
)
with check (
  exists (
    select 1
    from public.project_extra_payments p
    where p.id = project_extra_payment_attachments.payment_id
      and (
        p.requested_by = auth.uid()
        or public.current_role() in ('admin','rh','financeiro')
      )
  )
);

-- =========================================================
-- Auditoria
-- =========================================================

create table if not exists public.project_extra_payments_audit (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid null references public.project_extra_payments(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,

  action text not null check (action in ('insert','update','delete')),
  old_row jsonb null,
  new_row jsonb null,

  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_extra_payments_audit_payment on public.project_extra_payments_audit(payment_id, created_at desc);
create index if not exists idx_extra_payments_audit_project on public.project_extra_payments_audit(project_id, created_at desc);

alter table public.project_extra_payments_audit enable row level security;

drop policy if exists extra_payments_audit_select_via_payment on public.project_extra_payments_audit;
create policy extra_payments_audit_select_via_payment
on public.project_extra_payments_audit
for select
to authenticated
using (
  payment_id is null
  or exists (
    select 1
    from public.project_extra_payments p
    where p.id = project_extra_payments_audit.payment_id
  )
);

create or replace function public.log_project_extra_payments_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_action text;
  v_old jsonb;
  v_new jsonb;
  v_payment_id uuid;
  v_project_id uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_old := null;
    v_new := to_jsonb(new);
    v_payment_id := new.id;
    v_project_id := new.project_id;
  elsif tg_op = 'UPDATE' then
    v_action := 'update';
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_payment_id := new.id;
    v_project_id := new.project_id;
  else
    v_action := 'delete';
    v_old := to_jsonb(old);
    v_new := null;
    v_payment_id := old.id;
    v_project_id := old.project_id;
  end if;

  insert into public.project_extra_payments_audit (
    payment_id,
    project_id,
    action,
    old_row,
    new_row,
    created_by
  ) values (
    v_payment_id,
    v_project_id,
    v_action,
    v_old,
    v_new,
    auth.uid()
  );

  return coalesce(new, old);
end $$;

drop trigger if exists trg_project_extra_payments_audit on public.project_extra_payments;
create trigger trg_project_extra_payments_audit
after insert or update or delete on public.project_extra_payments
for each row execute function public.log_project_extra_payments_audit();

commit;

