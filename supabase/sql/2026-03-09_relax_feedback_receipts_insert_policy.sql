begin;

drop policy if exists feedback_receipts_insert_own_collaborator on public.feedback_receipts;
create policy feedback_receipts_insert_own_collaborator
on public.feedback_receipts
for insert
to authenticated
with check (
  collaborator_user_id = auth.uid()
);

commit;

