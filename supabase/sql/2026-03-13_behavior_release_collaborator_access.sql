begin;

drop policy if exists behavior_assessment_releases_select_scope on public.behavior_assessment_releases;
create policy behavior_assessment_releases_select_scope
on public.behavior_assessment_releases
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_role() in ('admin', 'rh')
  or exists (
    select 1
    from public.colaboradores c
    where c.id = collaborator_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists behavior_assessments_insert_own on public.behavior_assessments;
create policy behavior_assessments_insert_own
on public.behavior_assessments
for insert
to authenticated
with check (
  (
    invite_id is not null
    and user_id is null
  )
  or
  (
    (
      user_id = auth.uid()
      or exists (
        select 1
        from public.colaboradores c
        where c.id = collaborator_id
          and c.user_id = auth.uid()
      )
    )
    and exists (
      select 1
      from public.behavior_assessment_releases r
      where r.is_active = true
        and current_date between r.window_start and r.window_end
        and (
          r.user_id = auth.uid()
          or exists (
            select 1
            from public.colaboradores c
            where c.id = r.collaborator_id
              and c.user_id = auth.uid()
          )
        )
    )
  )
);

commit;
