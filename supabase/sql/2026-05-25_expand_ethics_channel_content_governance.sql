begin;

alter table public.ethics_channel_content
  add column if not exists publication_status text not null default 'published';

alter table public.ethics_channel_content
  add column if not exists legal_notice text null,
  add column if not exists non_retaliation_policy text null,
  add column if not exists report_types jsonb not null default '[]'::jsonb,
  add column if not exists out_of_scope jsonb not null default '[]'::jsonb,
  add column if not exists treatment_flow jsonb not null default '[]'::jsonb,
  add column if not exists analysis_deadline text null,
  add column if not exists footer_note text null,
  add column if not exists custom_primary_color text null,
  add column if not exists draft_content jsonb null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ethics_channel_content_publication_status_check'
      and conrelid = 'public.ethics_channel_content'::regclass
  ) then
    alter table public.ethics_channel_content
      add constraint ethics_channel_content_publication_status_check
      check (publication_status in ('draft', 'published', 'inactive'));
  end if;
end $$;

create table if not exists public.ethics_channel_content_audit (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  content_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ethics_channel_content_audit_company_created
  on public.ethics_channel_content_audit(company_id, created_at desc);

alter table public.ethics_channel_content_audit enable row level security;

drop policy if exists ethics_channel_content_audit_select_admin on public.ethics_channel_content_audit;
create policy ethics_channel_content_audit_select_admin
on public.ethics_channel_content_audit
for select
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
);

drop policy if exists ethics_channel_content_audit_insert_admin on public.ethics_channel_content_audit;
create policy ethics_channel_content_audit_insert_admin
on public.ethics_channel_content_audit
for insert
to authenticated
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;
