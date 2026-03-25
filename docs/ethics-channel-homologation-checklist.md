# Checklist de Homologacao do Canal de Etica

## Banco e seguranca

- Aplicar a migration [`supabase/sql/2026-03-24_create_ethics_cases.sql`](../supabase/sql/2026-03-24_create_ethics_cases.sql).
- Confirmar que `public.ethics_cases`, `public.ethics_case_history` e `public.ethics_case_attachments` estao com `RLS = true`.
- Aplicar a migration [`supabase/sql/2026-03-25_restrict_v_cargo_role_view.sql`](../supabase/sql/2026-03-25_restrict_v_cargo_role_view.sql).
- Validar que `public.v_cargo_role` nao esta mais exposta para `anon` e `authenticated`.
- Confirmar que `ethics_cases.company_id` esta preenchido e com `not null`.

## Fluxo publico

- Abrir [`/canal-de-etica/solida`](../src/app/canal-de-etica/[company]/[tab]/page.tsx).
- Registrar um relato anonimo completo.
- Confirmar exibicao do modal suspenso com protocolo e resumo.
- Confirmar que o protocolo aparece em `Acompanhar relato`.
- Confirmar que a consulta por protocolo mostra status, tipo, abertura, assunto e historico.
- Registrar um segundo relato identificado.
- Confirmar persistencia de nome, email e demais campos esperados.

## Painel administrativo

- Entrar em [`/admin/canal-de-etica`](../src/app/(portal)/admin/canal-de-etica/page.tsx) com perfil `admin`, `rh` e `compliance`.
- Confirmar acesso liberado apenas para perfis autorizados.
- Confirmar redirecionamento para `/unauthorized` com usuario sem permissao.
- Validar que a listagem carrega apenas casos da empresa do usuario.
- Alterar status de um caso e confirmar registro em historico.
- Atribuir um responsavel e confirmar que apenas colaboradores elegiveis da mesma empresa aparecem.
- Encerrar um caso e confirmar atualizacao de `closed_at`.

## Rastreabilidade

- Validar criacao de linha inicial em `ethics_case_history` ao registrar um relato publico.
- Validar que mudancas de status, atribuicao e observacoes geram novas entradas em historico.
- Confirmar que a busca por protocolo continua funcionando depois de atualizacoes internas.

## Publicacao

- Rodar `npm run build`.
- Testar o fluxo em producao apos deploy.
- Conferir se o alerta do Supabase sobre `rls_desativado_em_publico` desapareceu.
