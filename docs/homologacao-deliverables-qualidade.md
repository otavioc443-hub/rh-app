# Checklist de Homologacao - Qualidade e Produtividade de Entregaveis

## 1. Preparacao
- Confirmar backup do banco antes das migrations.
- Aplicar as migrations:
  - `supabase/sql/2026-02-19_enforce_deliverable_quality_workflow.sql`
  - `supabase/sql/2026-02-19_create_deliverable_operational_alerts.sql`
- Validar se o usuario de teste possui perfis: `admin`, `gestor`, `coordenador`, `colaborador`.

## 2. Fluxo principal sem retrabalho
- Criar entregavel com `due_date` para hoje + 1 dia.
- Alterar status: `pending -> in_progress -> sent -> approved`.
- Validar no banco (`project_deliverables`):
  - `approved_at` preenchido.
  - `approved_on_time = true`.
  - `approved_without_rework = true`.
  - `rework_count = 0`.

## 3. Fluxo com retrabalho
- Criar entregavel e enviar para revisao (`sent`).
- Retornar para ajuste (`in_progress` ou `pending`) com comentario obrigatorio.
- Reenviar e aprovar.
- Validar no banco:
  - `rework_count > 0`.
  - `approved_without_rework = false`.
  - `approved_on_time` conforme prazo.

## 4. Validacao de regra de transicao
- Tentar transicao invalida (ex.: `approved -> in_progress`).
- Confirmar erro de validacao no update.

## 5. Ranking (Coordenador / Gestor / Diretoria)
- Abrir painel e expandir ranking.
- Validar:
  - lista em ordem decrescente por score.
  - produtividade/qualidade de acordo com aprovacoes no prazo e sem retrabalho.
  - evidencias por colaborador (`Sem retrabalho X/Y`, `Retrabalho N`).
- Trocar janela do ranking (`30`, `90`, `365`, `historico`) e confirmar recalculo.

## 6. SLA e alertas
- Validar card `SLA de aprovacao`.
- Gerar um `returned_for_rework` e confirmar:
  - card de `Alertas operacionais` aumenta.
  - notificacao criada em `notifications` para responsaveis e dono do projeto.

## 7. Auditoria visual
- Validar timelines:
  - evento exibido como `Retornou para ajuste` (nao codigo tecnico).
  - status exibido amigavel (`Pendente`, `Em andamento`, etc).

## 8. Criterios de aceite
- Nenhuma regressao de permissao.
- Ranking refletindo regra de negocio definida.
- Migrations idempotentes e sem erro em reexecucao.
- Build da aplicacao sem erros.

## 9. Governanca de projeto (Diretoria x Gestor)
- Aplicar as migrations:
  - `supabase/sql/2026-02-19_allow_diretoria_project_assignment_and_edit.sql`
  - `supabase/sql/2026-02-19_restrict_project_status_updates_to_diretoria.sql`
- Rodar script de validacao:
  - `supabase/sql/2026-02-19_validate_project_governance_diretoria.sql`
- Testar em UI:
  - Diretoria > Novo projeto: criar projeto escolhendo gestor responsavel.
  - Diretoria > Novo projeto: editar projeto existente e salvar.
  - Gestor > Projetos: confirmar que status aparece somente leitura.
  - Diretoria > Projetos: confirmar alteracao de etapa/status com registro em timeline.

## 10. Automacao de notificacoes (Aprovacao de documento)
- Aplicar migration:
  - `supabase/sql/2026-02-19_create_notification_automation_rules.sql`
  - `supabase/sql/2026-02-19_create_notification_automation_rules_audit.sql`
- Rodar script de validacao:
  - `supabase/sql/2026-02-19_validate_notification_automation.sql`
- Testar em UI:
  - Admin > Notificacoes: habilitar evento `deliverable_approved` e salvar.
  - Coordenador/Gestor: aprovar um entregavel (`sent -> approved`).
  - Colaborador responsavel: validar recebimento na campainha de notificacoes.
  - Repetir com `approved_with_comments` e validar notificacao correspondente.
  - Alterar uma regra e validar registro em `notification_automation_rules_audit`.
