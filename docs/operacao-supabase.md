# Operacao Supabase (Sem Publicacao)

Este guia e para validar ambiente e seguranca antes de publicar.

## 1) Rodar preflight SQL

No Supabase SQL Editor, execute o arquivo:

- `supabase/sql/preflight_checks.sql`
- `supabase/sql/audit_policy_functions.sql`
- `supabase/sql/audit_grants.sql`

Ele valida:

- consistencia entre `auth.users` e `public.profiles`
- status de RLS nas tabelas criticas
- existencia de policies nas tabelas criticas
- existencia do bucket `company-logos`
- configuracao das funcoes usadas em policies (`is_rh_or_admin`, `current_role`)
- grants efetivos em tabelas/schemas criticos (`public` e `storage`)

Se precisar reaplicar a base de hardening:

- `supabase/sql/2026-02-11_hardening_policies.sql`
- `supabase/sql/2026-02-11_hardening_policy_functions.sql`
- `supabase/sql/2026-02-11_hardening_storage_objects_policies.sql`

Para habilitar PDI funcional no portal:

- `supabase/sql/2026-02-11_create_pdi_items.sql`
- `supabase/sql/2026-02-11_create_competencias_assessments.sql`
- `supabase/sql/2026-02-11_create_institutional_events.sql`
- `supabase/sql/2026-02-11_create_performance_assessments.sql`

## 2) Conferir variaveis de ambiente

No ambiente local/deploy, valide:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_AUTH_REDIRECT_TO`

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
- Perfil/feedback em `/meu-perfil/perfil` e `/meu-perfil/feedback`

## 5) Se tudo estiver ok

Somente depois disso, publicar commit/tag no remoto.
