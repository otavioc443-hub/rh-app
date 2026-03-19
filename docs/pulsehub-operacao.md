# Operacao do PulseHub

Este guia resume o que precisa ser aplicado e validado para colocar o pacote atual do `PulseHub` em funcionamento completo.

Checklist de implantacao consolidado:

- `docs/pulsehub-deploy-checklist.md`

## 1. Migrations obrigatorias

Rode no Supabase SQL Editor, nesta ordem:

1. `supabase/sql/2026-03-03_create_internal_social_network_tables.sql`
2. `supabase/sql/2026-03-03_create_internal_social_media_bucket.sql`
3. `supabase/sql/2026-03-03_add_pinned_post_and_project_board_to_internal_social.sql`
4. `supabase/sql/2026-03-18_make_internal_social_media_bucket_private.sql`
5. `supabase/sql/2026-03-19_expand_pulsehub_quickwins.sql`
6. `supabase/sql/2026-03-19_expand_pulsehub_communities_polls_moderation.sql`
7. `supabase/sql/2026-03-19_expand_pulsehub_home_analytics_moderation_controls.sql`

## 2. Recursos cobertos por cada pacote

### Base social

- feed geral e por projeto
- comentarios, reacoes e mensagens diretas
- upload de midia
- post fixado
- quadro colaborativo por projeto

### Quick wins

- comunicados e campanhas internas
- notificacoes persistidas
- mencoes por `@handle`
- hashtags
- posts salvos
- cards de aniversariantes e novos membros

### Comunidades, enquetes e moderacao

- grupos/comunidades
- publicacao por comunidade
- enquete vinculada ao post
- denuncias
- fila inicial de moderacao

### Home e controles ampliados

- analytics de engajamento
- canal oficial com comunicados recentes
- ocultar/restaurar publicacao

## 3. Endpoints impactados

- `POST /api/institucional/rede-social/upload`
- `POST /api/institucional/rede-social/media-urls`
- `POST /api/institucional/rede-social/sync`
- `POST /api/institucional/presence`

## 4. Bucket e seguranca

Bucket usado:

- `internal-social-media`

Validacoes esperadas:

- bucket existente no Storage
- bucket privado
- acesso a midia via URL assinada

## 5. Variaveis de ambiente

Validar no ambiente:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 6. Perfis com acesso ampliado

Perfis com maior governanca no `PulseHub`:

- `admin`
- `diretoria`
- `rh`

Esses perfis participam de:

- publicacao de comunicados/campanhas
- criacao e gestao de comunidades
- fila de moderacao
- ocultar/restaurar publicacao

## 7. Validacao tecnica recomendada

No projeto:

```bash
npm run lint
npm run build
```

## 8. Falhas comuns

### Erro de tabela/coluna ausente

Sintoma:

- mensagens citando `schema cache`, `does not exist` ou nome de tabela do PulseHub

Acao:

- aplicar a migration indicada no erro

### Midia nao abre

Sintoma:

- imagem/video nao carrega no feed ou na mensagem

Acao:

- validar bucket `internal-social-media`
- confirmar que o bucket esta privado
- confirmar que as URLs estao sendo assinadas pela API

### Comunidade ou enquete nao aparece

Acao:

- validar `2026-03-19_expand_pulsehub_communities_polls_moderation.sql`

### Ocultar/restaurar publicacao nao funciona

Acao:

- validar `2026-03-19_expand_pulsehub_home_analytics_moderation_controls.sql`

## 9. Proximo passo apos deploy

Depois de aplicar SQL e validar localmente:

1. homologar com RH/Admin/Diretoria
2. confirmar comunicados, notificacoes e moderacao
3. acompanhar uso inicial da aba `Comunidades`
