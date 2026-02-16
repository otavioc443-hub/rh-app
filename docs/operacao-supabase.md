# Operacao Supabase (Sem Publicacao)

Este guia e para validar ambiente e seguranca antes de publicar.

## 1) Rodar preflight SQL

No Supabase SQL Editor, execute o arquivo:

- `supabase/sql/preflight_checks.sql`
- `supabase/sql/audit_policy_functions.sql`
- `supabase/sql/audit_grants.sql`
- `supabase/sql/preflight_feature_modules.sql`

Ele valida:

- consistencia entre `auth.users` e `public.profiles`
- status de RLS nas tabelas criticas
- existencia de policies nas tabelas criticas
- existencia do bucket `company-logos`
- configuracao das funcoes usadas em policies (`is_rh_or_admin`, `current_role`)
- grants efetivos em tabelas/schemas criticos (`public` e `storage`)
- estado dos modulos novos (tabelas, RLS e policies)

Se precisar reaplicar a base de hardening:

- `supabase/sql/2026-02-11_hardening_policies.sql`
- `supabase/sql/2026-02-11_hardening_policy_functions.sql`
- `supabase/sql/2026-02-11_hardening_storage_objects_policies.sql`
- `supabase/sql/2026-02-12_fix_updated_at_columns.sql` (corrige erro de trigger `set_updated_at`)

Para habilitar PDI funcional no portal:

- `supabase/sql/2026-02-11_create_pdi_items.sql`
- `supabase/sql/2026-02-11_create_competencias_assessments.sql`
- `supabase/sql/2026-02-11_create_institutional_events.sql`
- `supabase/sql/2026-02-11_create_performance_assessments.sql`

Para habilitar fluxo completo de feedback:

- `supabase/sql/2026-02-12_feedback_workflow.sql`

Para habilitar modulo de projetos (gestor/coordenador):

- `supabase/sql/2026-02-12_create_projects_module.sql`

Para habilitar equipes nomeadas por projeto (Civil, Eletrica, etc):

- `supabase/sql/2026-02-13_create_project_teams.sql`

Para permitir que membros do mesmo projeto vejam nomes/avatares em telas de equipe:

- `supabase/sql/2026-02-13_profiles_select_project_peers.sql`

Para fornecer nome/cargo/avatar dos membros do projeto via RPC (sem mostrar e-mail):

- `supabase/sql/2026-02-13_project_member_directory_rpc.sql`

Para habilitar solicitacao de pagamentos extras (Gestor -> Financeiro/RH/Admin):

- `supabase/sql/2026-02-13_create_project_extra_payments.sql`

Para anexos/comprovantes e auditoria dos pagamentos extras:

- `supabase/sql/2026-02-13_create_extra_payment_attachments_bucket.sql`
- `supabase/sql/2026-02-13_project_extra_payments_audit_attachments.sql`

Para registrar orcamento/custo total planejado por projeto (opcional):

- `supabase/sql/2026-02-13_add_projects_budget_total.sql`

Para habilitar a role "financeiro" (e policies de leitura/decisão financeira):

- `supabase/sql/2026-02-13_add_financeiro_role.sql`

Para habilitar conteudo institucional (Visao geral) e upload de imagens no RH:

- `supabase/sql/2026-02-13_create_institutional_content.sql`
- `supabase/sql/2026-02-13_create_institutional_assets_bucket.sql`

Para habilitar publicacao (draft/published) e historico/restauracao do institucional:

- `supabase/sql/2026-02-13_institutional_image_focus.sql` (foco/enquadramento do hero)
- `supabase/sql/2026-02-13_institutional_publishing.sql` (draft/published + RPC publicar)
- `supabase/sql/2026-02-13_institutional_publishing_backfill.sql` (cria published inicial)
- `supabase/sql/2026-02-13_institutional_content_versions.sql` (historico + restaurar rascunho)

Ordem sugerida apos aplicar SQLs:

1. `supabase/sql/preflight_feature_modules.sql`
2. `supabase/sql/preflight_checks.sql`
3. `supabase/sql/audit_policy_functions.sql`
4. `supabase/sql/audit_grants.sql`
5. `supabase/sql/preflight_feedback_flow.sql`

## 2) Conferir variaveis de ambiente

No ambiente local/deploy, valide:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_AUTH_REDIRECT_TO`

## 2.1) Uploads (Padrao Atual)

O projeto usa uploads via endpoints do servidor (Next.js Route Handlers) com `SUPABASE_SERVICE_ROLE_KEY` para evitar bloqueios por RLS em `storage.objects`.

Uploads implementados:

- Institucional (RH):
  - Tela: `/rh/institucional`
  - Endpoint: `POST /api/rh/institucional/upload`
  - Bucket: `institutional-assets`
  - Permissao: `rh/admin` via `rpc('current_role')` + `rpc('current_active')` (com fallback para `profiles`)

- Logo da empresa (Admin):
  - Tela: `/admin/empresas`
  - Endpoint: `POST /api/admin/company-logo/upload`
  - Bucket: `company-logos`
  - Permissao: `admin` via `rpc('current_role')` + `rpc('current_active')` (com fallback para `profiles`)
  - Observacao: retorna URL com `?v=timestamp` para evitar cache quando o arquivo e sobrescrito em `{cnpj}/logo.png`.

- Avatar do usuario (Meu Perfil):
  - Tela: `/meu-perfil/perfil`
  - Endpoint: `POST /api/me/avatar/upload`
  - Bucket: `avatars`
  - Permissao: usuario autenticado (cookie de sessao). O caminho e fixo em `{userId}/avatar.{ext}`.
  - Observacao: retorna URL com `?v=timestamp` para evitar cache.

Requisitos importantes:

- `SUPABASE_SERVICE_ROLE_KEY` deve existir no ambiente do servidor.
- Os buckets precisam existir no Supabase Storage: `company-logos`, `institutional-assets`, `avatars`.
- O front chama os endpoints com `credentials: 'include'` (cookies) e, quando aplicavel, `Authorization: Bearer <access_token>`.

## 3) Testes do projeto

No projeto:

```bash
npm run lint
npm run build
npm run test:admin-flow
```

## 4) Checklist funcional rapido (manual)

- Login com admin
- Acesso a `/admin` e `/admin/empresas`
- Convite de usuario (admin/rh)
- Fluxo RH em `/rh`
- Organograma em `/institucional/organograma`
- Feedback coordenador em `/coordenador/feedback`
- Feedback gestor em `/gestor/feedback`
- Governanca RH em `/rh/feedbacks`
- Historico do colaborador em `/meu-perfil/feedback`

## 5) Se tudo estiver ok

Somente depois disso, publicar commit/tag no remoto.
