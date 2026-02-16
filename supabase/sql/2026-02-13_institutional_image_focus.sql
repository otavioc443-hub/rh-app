-- Permite ajustar o enquadramento (foco) das imagens do topo no institucional.
-- Para itens (history/values/culture) o foco fica dentro do JSON (focus_x/focus_y) e nao precisa de coluna.

begin;

alter table public.institutional_content
  add column if not exists hero_focus_x numeric null;

alter table public.institutional_content
  add column if not exists hero_focus_y numeric null;

commit;

