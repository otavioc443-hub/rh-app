begin;

create table if not exists public.lms_question_bank (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  created_by uuid null references public.profiles(id) on delete set null,
  title text not null,
  statement text not null,
  help_text text null,
  question_type text not null check (question_type in ('single_choice','multiple_choice','true_false','short_text','essay','image_choice')),
  image_url text null,
  accepted_answers text[] not null default '{}',
  requires_manual_review boolean not null default false,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_question_bank_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.lms_question_bank(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  image_url text null
);

create index if not exists idx_lms_question_bank_company on public.lms_question_bank(company_id, updated_at desc);
create index if not exists idx_lms_question_bank_type on public.lms_question_bank(question_type);
create index if not exists idx_lms_question_bank_options_question on public.lms_question_bank_options(question_id);

alter table public.lms_question_bank enable row level security;
alter table public.lms_question_bank_options enable row level security;

drop policy if exists lms_question_bank_read on public.lms_question_bank;
create policy lms_question_bank_read
on public.lms_question_bank
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and p.role in ('admin','rh')
      and (
        p.company_id is null
        or lms_question_bank.company_id is null
        or lms_question_bank.company_id = p.company_id
      )
  )
);

drop policy if exists lms_question_bank_manage on public.lms_question_bank;
create policy lms_question_bank_manage
on public.lms_question_bank
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and p.role in ('admin','rh')
      and (
        p.company_id is null
        or lms_question_bank.company_id is null
        or lms_question_bank.company_id = p.company_id
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.active, true) = true
      and p.role in ('admin','rh')
      and (
        p.company_id is null
        or lms_question_bank.company_id is null
        or lms_question_bank.company_id = p.company_id
      )
  )
);

drop policy if exists lms_question_bank_options_read on public.lms_question_bank_options;
create policy lms_question_bank_options_read
on public.lms_question_bank_options
for select
to authenticated
using (
  exists (
    select 1
    from public.lms_question_bank q
    join public.profiles p on p.id = auth.uid()
    where q.id = lms_question_bank_options.question_id
      and coalesce(p.active, true) = true
      and p.role in ('admin','rh')
      and (
        p.company_id is null
        or q.company_id is null
        or q.company_id = p.company_id
      )
  )
);

drop policy if exists lms_question_bank_options_manage on public.lms_question_bank_options;
create policy lms_question_bank_options_manage
on public.lms_question_bank_options
for all
to authenticated
using (
  exists (
    select 1
    from public.lms_question_bank q
    join public.profiles p on p.id = auth.uid()
    where q.id = lms_question_bank_options.question_id
      and coalesce(p.active, true) = true
      and p.role in ('admin','rh')
      and (
        p.company_id is null
        or q.company_id is null
        or q.company_id = p.company_id
      )
  )
)
with check (
  exists (
    select 1
    from public.lms_question_bank q
    join public.profiles p on p.id = auth.uid()
    where q.id = lms_question_bank_options.question_id
      and coalesce(p.active, true) = true
      and p.role in ('admin','rh')
      and (
        p.company_id is null
        or q.company_id is null
        or q.company_id = p.company_id
      )
  )
);

create or replace function public.set_lms_question_bank_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lms_question_bank_updated_at on public.lms_question_bank;
create trigger trg_lms_question_bank_updated_at
before update on public.lms_question_bank
for each row
execute function public.set_lms_question_bank_updated_at();

commit;
