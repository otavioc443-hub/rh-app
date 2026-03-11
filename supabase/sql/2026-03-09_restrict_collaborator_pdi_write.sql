begin;

-- Colaborador pode acompanhar seus itens de PDI, mas nao pode incluir/alterar/excluir.
-- Escrita fica restrita a papeis de gestao (coordenador/gestor/rh/admin etc.)
-- mantendo sempre o escopo do proprio user_id para evitar escrita cruzada.

drop policy if exists pdi_items_insert_own on public.pdi_items;
create policy pdi_items_insert_own
on public.pdi_items
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.current_role() <> 'colaborador'
);

drop policy if exists pdi_items_update_own on public.pdi_items;
create policy pdi_items_update_own
on public.pdi_items
for update
to authenticated
using (
  user_id = auth.uid()
  and public.current_role() <> 'colaborador'
)
with check (
  user_id = auth.uid()
  and public.current_role() <> 'colaborador'
);

drop policy if exists pdi_items_delete_own on public.pdi_items;
create policy pdi_items_delete_own
on public.pdi_items
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.current_role() <> 'colaborador'
);

commit;
