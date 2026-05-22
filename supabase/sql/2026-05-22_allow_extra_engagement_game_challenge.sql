-- Permite mais de um desafio diario, separando por tipo de jogo.
-- Ex.: Pulse Sprint e Trilha Pulse podem pontuar no mesmo dia.

drop index if exists public.uq_engagement_game_sessions_completed_once_per_day;

create unique index if not exists uq_engagement_game_sessions_completed_once_per_day_game
  on public.engagement_game_sessions(user_id, play_date, game_slug)
  where session_state = 'completed';

create index if not exists idx_engagement_game_sessions_user_day_game
  on public.engagement_game_sessions(user_id, play_date desc, game_slug, session_state);
