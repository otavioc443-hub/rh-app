# Roadmap Tecnico do PulseHub

Este documento transforma a analise da rede social interna em backlog executavel para aproximar o `PulseHub` de uma intranet corporativa mais completa, com foco em comunicacao institucional, comunidade, descoberta e governanca.

## 1. Estado atual

Hoje o `PulseHub` ja possui base funcional relevante:

- feed geral e feed por projeto
- posts com imagem e video
- comentarios e reacoes
- post fixado
- busca global por pessoas, posts, projetos e conversas
- perfil basico do membro
- mensagens diretas com anexos
- presenca online e ultimo acesso
- quadro colaborativo por projeto
- anexos privados com URL assinada

Base tecnica ja existente:

- UI principal: `src/app/(portal)/institucional/rede-social/page.tsx`
- perfil de membro: `src/app/(portal)/institucional/rede-social/membros/[id]/page.tsx`
- upload de midia: `src/app/api/institucional/rede-social/upload/route.ts`
- tabelas principais: `supabase/sql/2026-03-03_create_internal_social_network_tables.sql`
- post fixado e quadro por projeto: `supabase/sql/2026-03-03_add_pinned_post_and_project_board_to_internal_social.sql`

## 2. Objetivo do proximo ciclo

Evoluir o `PulseHub` de "feed social interno" para "hub de comunicacao e relacionamento corporativo", com tres pilares:

- comunicacao institucional estruturada
- comunidades e descoberta de pessoas/conteudo
- governanca e notificacao confiavel

## 3. Principais gaps

Os principais gaps identificados para aproximar o modulo de uma intranet empresarial semelhante ao Facebook sao:

1. Falta separar `comunicado oficial` de `post social`.
2. Falta `grupos/comunidades` fora do contexto de projeto.
3. Falta `central de notificacoes` persistida no servidor.
4. Falta `@mencoes`, `hashtags`, `posts salvos` e filtros por tipo de conteudo.
5. Falta ampliar o perfil do colaborador com contexto profissional.
6. Falta `enquetes`, `eventos`, `aniversarios` e mecanismos de reconhecimento.
7. Falta `moderacao`, denuncia, analytics e governanca de conteudo.
8. Mensagens diretas ainda nao possuem trilha robusta de leitura/entrega.

## 4. Priorizacao recomendada

### Fase 1: quick wins de alto impacto

Objetivo: aumentar utilidade diaria sem refatoracao pesada.

Entradas:

- tipo de publicacao `comunicado`
- `@mencoes` em posts e comentarios
- `hashtags`
- `posts salvos`
- central de notificacoes
- card de `aniversariantes` e `novos membros`
- categorias de post no feed

Valor:

- melhora descoberta e retorno recorrente
- cria canal institucional visivel
- reduz dependencia de comunicacoes externas

### Fase 2: camada de comunidade

Objetivo: sair do modelo empresa/projeto e abrir comunidades por interesse ou area.

Entradas:

- grupos/comunidades
- feed por grupo
- moderadores de grupo
- convite e adesao
- enquetes
- eventos internos
- ranking simples de engajamento por grupo

Valor:

- aumenta pertencimento
- reduz ruido no feed geral
- cria espacos para cultura, areas e iniciativas

### Fase 3: intranet corporativa completa

Objetivo: transformar a aba inicial em uma home institucional.

Entradas:

- home com widgets
- mural oficial
- agenda e eventos
- acessos rapidos e links fixos
- reconhecimento interno
- analytics de uso e adocao
- fila de moderacao

Valor:

- posiciona o PulseHub como ponto central de comunicacao
- melhora governanca
- cria visao executiva de saude da rede

## 5. Backlog detalhado

### 5.1 Comunicacao institucional

Implementar:

- tipo de post: `social`, `comunicado`, `campanha`, `evento`, `reconhecimento`
- destaque visual para posts institucionais
- agendamento de publicacao
- expiracao opcional de banners/comunicados
- autoria institucional opcional (`RH`, `Diretoria`, `Comunicacao`)

Banco sugerido:

- adicionar em `internal_social_posts`:
  - `post_type text not null default 'social'`
  - `priority text null`
  - `scheduled_at timestamptz null`
  - `expires_at timestamptz null`
  - `official_author_label text null`

API/UI:

- filtros no feed por tipo
- bloco superior para `Comunicados`
- permissao de criacao restrita por role para alguns tipos

### 5.2 Notificacoes persistidas

Implementar:

- notificacao para comentario, reacao, mencao, mensagem, comunicado e convite de grupo
- contador de nao lidas
- marcar uma ou todas como lidas

Banco sugerido:

- nova tabela `internal_social_notifications`
  - `id`
  - `user_id`
  - `actor_user_id`
  - `kind`
  - `entity_type`
  - `entity_id`
  - `title`
  - `body`
  - `read_at`
  - `created_at`

Observacao:

- hoje a leitura de conversa e controlada no cliente; vale mover estado critico para o banco.

### 5.3 Mencoes, hashtags e descoberta

Implementar:

- parse de `@nome`
- parse de `#assunto`
- clique para navegar por hashtag
- autocomplete de pessoas
- salvar post

Banco sugerido:

- `internal_social_mentions`
- `internal_social_hashtags`
- `internal_social_saved_posts`

API/UI:

- busca por hashtag
- painel `Assuntos em alta`
- highlight de mencoes em posts e comentarios

### 5.4 Comunidades e grupos

Implementar:

- grupos por area, unidade, iniciativa, cultura ou interesse
- papeis: `owner`, `moderator`, `member`
- feed dedicado
- posts privados do grupo

Banco sugerido:

- `internal_social_groups`
- `internal_social_group_members`
- opcional: estender `internal_social_posts` para `audience_type = 'group'`

API/UI:

- aba `Comunidades`
- exploracao por grupos sugeridos
- entrada e saida do grupo

### 5.5 Perfil profissional ampliado

Implementar:

- habilidades
- gestor imediato
- unidade/area
- projetos recentes
- data de entrada
- mini bio

Banco sugerido:

- preferencialmente ampliar `profiles` ou criar tabela complementar `profile_directory_meta`

API/UI:

- perfil mais rico
- sugestao de conexoes por area/projeto
- busca por habilidade e setor

### 5.6 Engajamento institucional

Implementar:

- enquetes
- aniversariantes
- boas-vindas a novos colaboradores
- reconhecimentos publicos
- eventos internos com RSVP simples

Banco sugerido:

- `internal_social_polls`
- `internal_social_poll_options`
- `internal_social_poll_votes`
- `internal_social_events`
- `internal_social_recognitions`

### 5.7 Moderacao e governanca

Implementar:

- denunciar post/comentario
- ocultar ou arquivar publicacao
- fila de moderacao
- auditoria basica de acao de moderador

Banco sugerido:

- `internal_social_reports`
- `internal_social_moderation_actions`

API/UI:

- painel admin/RH/comunicacao
- filtros por denuncia, autor, grupo, periodo

### 5.8 Mensagens mais maduras

Implementar:

- `delivered_at` e `read_at`
- notificacao persistida de mensagem
- fixar conversa
- pesquisa dentro da thread

Banco sugerido:

- adicionar em `internal_social_direct_messages`:
  - `delivered_at timestamptz null`
  - `read_at timestamptz null`

## 6. Ordem de entrega sugerida

### Sprint 1

- post institucional
- notificacoes persistidas
- mencoes
- hashtags
- posts salvos

### Sprint 2

- aniversariantes e boas-vindas
- filtros por categoria
- perfil ampliado
- mensagens com `read_at`

### Sprint 3

- grupos/comunidades
- enquetes
- eventos
- denuncias e moderacao inicial

### Sprint 4

- home institucional com widgets
- analytics de adesao
- ranking de engajamento
- governanca ampliada

## 7. Dependencias tecnicas

Antes de iniciar o backlog, vale alinhar:

- quais roles podem publicar `comunicados`
- quem pode moderar conteudo
- se grupos serao abertos, privados ou ambos
- se perfil profissional usara `profiles`, `colaboradores` ou tabela dedicada
- quais indicadores de adocao importam para diretoria e RH

## 8. MVP recomendado

Se a decisao for atacar o maior ganho com menor risco, o MVP recomendado para o proximo ciclo e:

1. `comunicados oficiais`
2. `notificacoes persistidas`
3. `@mencoes`
4. `hashtags`
5. `posts salvos`
6. `aniversariantes/boas-vindas`

Esse pacote ja muda a percepcao do modulo de forma clara sem exigir reestruturacao completa do feed.

## 9. Criterios de validacao

O ciclo pode ser considerado bem-sucedido se:

- usuarios identificarem facilmente comunicados institucionais
- o volume de interacao em posts crescer
- mensagens e interacoes nao dependam apenas da aba aberta
- a busca por pessoas e assuntos melhorar
- RH/Diretoria conseguirem usar o PulseHub como canal oficial interno

## 10. Proximo passo recomendado

Executar primeiro um pacote tecnico fechado:

1. migration para `post_type`, `mentions`, `hashtags`, `saved_posts` e `notifications`
2. ajustes da UI do feed
3. badge/icone de notificacoes
4. autocomplete de mencoes no composer
5. validacao funcional com RH/Admin

Se esse pacote for aprovado, o passo seguinte natural e abrir `grupos/comunidades`.
