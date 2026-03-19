# Deploy do PulseHub

Este checklist consolida a implantacao do pacote atual da rede social corporativa.

## 1. Pre-deploy

- confirmar backup logico ou snapshot recente do projeto Supabase
- validar `NEXT_PUBLIC_SUPABASE_URL`
- validar `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- validar `SUPABASE_SERVICE_ROLE_KEY`
- confirmar existencia do bucket `internal-social-media`
- confirmar que o bucket `internal-social-media` esta privado

## 2. Ordem de aplicacao no Supabase

Aplicar no SQL Editor, nesta ordem:

1. `supabase/sql/2026-03-03_create_internal_social_network_tables.sql`
2. `supabase/sql/2026-03-03_create_internal_social_media_bucket.sql`
3. `supabase/sql/2026-03-03_add_pinned_post_and_project_board_to_internal_social.sql`
4. `supabase/sql/2026-03-18_make_internal_social_media_bucket_private.sql`
5. `supabase/sql/2026-03-19_expand_pulsehub_quickwins.sql`
6. `supabase/sql/2026-03-19_expand_pulsehub_communities_polls_moderation.sql`
7. `supabase/sql/2026-03-19_expand_pulsehub_home_analytics_moderation_controls.sql`

## 3. Validacao tecnica imediata

No projeto:

```bash
npm run lint
npm run build
```

No Supabase:

1. executar `supabase/sql/preflight_feature_modules.sql`
2. executar `supabase/sql/preflight_checks.sql`
3. executar `supabase/sql/audit_policy_functions.sql`
4. executar `supabase/sql/audit_grants.sql`

## 4. Homologacao por perfil

### Usuario comum

- criar publicacao simples
- comentar e reagir
- salvar post
- usar `@mencao`
- abrir hashtag
- entrar em comunidade e votar em enquete
- denunciar publicacao
- validar recebimento de notificacoes

### RH / Admin / Diretoria

- publicar `Comunicado oficial`
- publicar `Campanha interna`
- criar ou gerenciar comunidade
- abrir fila de moderacao
- tratar denuncia
- ocultar e restaurar publicacao
- validar cards, analytics e canal oficial

## 5. Go-live assistido

- publicar 1 comunicado oficial de teste interno
- acompanhar notificacoes e atualizacao de feed
- monitorar erros de upload de midia
- monitorar erros de RLS ou `schema cache`
- acompanhar adesao inicial na aba `Comunidades`

## 6. Critério de aprovacao

Considerar o deploy aprovado quando:

- `lint` e `build` permanecem verdes
- feed, comunicados, comunidades e enquetes funcionam
- notificacoes persistidas sao geradas
- moderacao funciona para `admin`, `rh` e `diretoria`
- publicacoes ocultas deixam de aparecer para usuario comum
