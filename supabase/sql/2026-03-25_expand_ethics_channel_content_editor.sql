begin;

alter table public.ethics_channel_content
  add column if not exists faq_items jsonb not null default '[]'::jsonb;

alter table public.ethics_channel_content
  add column if not exists page_texts jsonb not null default '{}'::jsonb;

commit;
