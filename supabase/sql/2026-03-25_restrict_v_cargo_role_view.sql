begin;

revoke all on public.v_cargo_role from anon;
revoke all on public.v_cargo_role from authenticated;

commit;
