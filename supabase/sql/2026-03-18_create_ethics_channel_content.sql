begin;

create table if not exists public.ethics_channel_content (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  hero_title text null,
  hero_subtitle text null,
  heading text null,
  intro text null,
  hero_image_url text null,
  report_url text null,
  follow_up_url text null,
  contact_email text null,
  contact_phone text null,
  code_of_ethics_url text null,
  data_protection_url text null,
  code_summary text null,
  data_protection_summary text null,
  principles jsonb not null default '[]'::jsonb,
  foundation_title text null,
  foundation_subtitle text null,
  foundation_pillars jsonb not null default '[]'::jsonb,
  steer_title text null,
  steer_body text null,
  faq_items jsonb not null default '[]'::jsonb,
  page_texts jsonb not null default '{}'::jsonb,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_ethics_channel_content_company_unique
  on public.ethics_channel_content(company_id);

create index if not exists idx_ethics_channel_content_updated_at
  on public.ethics_channel_content(updated_at desc);

drop trigger if exists trg_ethics_channel_content_updated_at on public.ethics_channel_content;
create trigger trg_ethics_channel_content_updated_at
before update on public.ethics_channel_content
for each row execute function public.set_updated_at();

alter table public.ethics_channel_content enable row level security;

drop policy if exists ethics_channel_content_select_active on public.ethics_channel_content;
create policy ethics_channel_content_select_active
on public.ethics_channel_content
for select
to authenticated
using (
  public.current_active() = true
  and (
    public.current_role() in ('admin', 'rh')
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.company_id = ethics_channel_content.company_id
    )
  )
);

drop policy if exists ethics_channel_content_write_admin on public.ethics_channel_content;
create policy ethics_channel_content_write_admin
on public.ethics_channel_content
for all
to authenticated
using (
  public.current_active() = true
  and public.current_role() = 'admin'
)
with check (
  public.current_active() = true
  and public.current_role() = 'admin'
);

commit;
