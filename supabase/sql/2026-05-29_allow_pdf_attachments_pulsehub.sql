alter table if exists public.internal_social_post_attachments
  drop constraint if exists internal_social_post_attachments_type_check;

alter table if exists public.internal_social_post_attachments
  add constraint internal_social_post_attachments_type_check
  check (type in ('image', 'video', 'link', 'pdf'));
