# Pulse Sprint MVP

## Jogo escolhido

`Pulse Sprint` e um mini game de reflexo com grade `3x3`.

Por que ele e o mais adequado ao ambiente corporativo:

- dura cerca de `40 segundos`, com barreira de entrada quase zero
- funciona bem em `desktop` e `mobile`
- gera `recompensa imediata` e incentivo de retorno diario
- nao depende de curadoria diaria de perguntas, como um quiz
- permite evoluir depois para campanhas, ranking por setor e premios

## Regra de pontuacao

Cada rodada soma:

- `pontos base` por participacao
- `pontos de performance` por hits, combo, precisao e velocidade
- `bonus de streak` progressivo

Regra obrigatoria aplicada:

- se o colaborador ficar `1 dia sem jogar`, o `score_current` e a `streak` sao zerados
- o `score_total` permanece como historico consolidado

## Regra de reset diario

O reset foi estruturado em duas camadas:

1. funcao SQL `public.engagement_game_sync_all_resets()`
2. chamada automatica dessa funcao nas rotas de `status`, `start` e `submit`

Isso garante que, ao abrir o jogo, o ranking ou os widgets, jogadores com dia perdido tenham o placar atual atualizado para zero.

## Estrutura criada

### Banco

Migration:

- `supabase/sql/2026-03-19_create_daily_engagement_game.sql`

Objetos principais:

- `engagement_game_campaigns`
- `engagement_game_players`
- `engagement_game_sessions`
- `engagement_game_score_history`
- view `engagement_game_leaderboard`

### Frontend

Pagina principal:

- `src/app/(portal)/institucional/jogo-diario/page.tsx`

Componentes:

- `src/components/engagement-game/PulseSprint.tsx`

### Backend

Rotas:

- `src/app/api/institucional/jogo-diario/status/route.ts`
- `src/app/api/institucional/jogo-diario/start/route.ts`
- `src/app/api/institucional/jogo-diario/submit/route.ts`

Helpers:

- `src/lib/engagementGame.ts`
- `src/lib/server/engagementGameServer.ts`

## Integracao institucional

O widget do jogo foi integrado em:

- `src/app/(portal)/institucional/page.tsx`
- `src/app/(portal)/institucional/rede-social/page.tsx`

Com isso, o `Top 5`, o `Jogador do Dia` e o CTA do jogo ficam visiveis tanto na area institucional quanto no PulseHub.

## Instalacao

1. aplicar a migration no Supabase:

```sql
-- arquivo
supabase/sql/2026-03-19_create_daily_engagement_game.sql
```

2. garantir as variaveis ja usadas pelo projeto:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

3. subir o frontend normalmente:

```bash
npm run lint
npm run build
```

## Rotas do MVP

- pagina do jogo: `/institucional/jogo-diario`
- widget institucional: `/institucional`
- widget PulseHub: `/institucional/rede-social`

## Melhorias futuras

- campanhas tematicas por periodo
- premiacoes por faixa de desempenho
- ranking por setor e departamento
- destaque automatico no feed do PulseHub com card compartilhavel
- anti-cheat mais forte com verificacao round-a-round assinada
- missoes por equipe
- badges e trilhas de recompensa
