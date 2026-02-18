# Go-live - Entregaveis (Qualidade, Retrabalho, Ranking)

## Ordem recomendada (homologacao -> producao)
1. Aplicar migrations em homologacao:
   - `supabase/sql/2026-02-19_enforce_deliverable_quality_workflow.sql`
   - `supabase/sql/2026-02-19_create_deliverable_operational_alerts.sql`
2. Rodar sanity check:
   - `supabase/sql/2026-02-19_post_migration_sanity_checks.sql`
3. Executar checklist funcional:
   - `docs/homologacao-deliverables-qualidade.md`
4. Validar com usuarios chave (coordenador, gestor, diretoria, admin).
5. Repetir passos 1-4 em producao.

## Janela de deploy sugerida
- Escolher horario de menor uso.
- Congelar alteracoes em workflow de entregaveis durante aplicacao das migrations.
- Comunicar equipes sobre novas validacoes de status e motivo obrigatorio de retrabalho.

## Criterios de aceite para subir em producao
- Build sem erro.
- Sanity check sem inconsistencias criticas.
- Fluxos de aprovacao/retrabalho validados ponta a ponta.
- Ranking refletindo regra: aprovado no prazo e sem retrabalho.
- Notificacoes de retrabalho sendo geradas.

## Monitoração nas primeiras 48h
- Quantidade de `returned_for_rework`.
- Volume de notificacoes `deliverable_rework`.
- Erros de transicao invalida de status.
- Feedback de coordenador/gestor sobre leitura dos indicadores.

## Plano de contingencia
- Se houver bloqueio operacional:
  - Suspender uso da etapa afetada.
  - Corrigir regra de transicao/trigger em migration incremental.
  - Reprocessar KPIs via funcoes `refresh_*_quality_kpis`.
