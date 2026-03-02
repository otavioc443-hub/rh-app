begin;

alter table if exists public.session_audit
  drop constraint if exists session_audit_logout_reason_check;

alter table if exists public.session_audit
  add constraint session_audit_logout_reason_check
  check (
    logout_reason is null
    or logout_reason in ('manual', 'idle', 'token_expired', 'page_exit')
  );

commit;
