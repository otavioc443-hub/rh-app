# Operacao LGPD no Portal

Este guia resume o que precisa ser aplicado e validado para colocar o pacote atual de adequacao LGPD em funcionamento.

## 1. Migrations obrigatorias

Rode no Supabase SQL Editor, nesta ordem:

1. `supabase/sql/2026-03-18_make_internal_social_media_bucket_private.sql`
2. `supabase/sql/2026-03-18_create_lgpd_requests.sql`
3. `supabase/sql/2026-03-18_create_lgpd_request_audit.sql`

## 2. Variaveis de ambiente

Configure na Vercel:

- `NEXT_PUBLIC_LGPD_CONTACT_NAME`
- `NEXT_PUBLIC_LGPD_CONTACT_EMAIL`
- `NEXT_PUBLIC_LGPD_CONTACT_PHONE`
- `NEXT_PUBLIC_LGPD_REQUEST_URL`

Observacoes:

- `NEXT_PUBLIC_LGPD_CONTACT_EMAIL` e o principal ponto de contato visivel no portal.
- `NEXT_PUBLIC_LGPD_REQUEST_URL` e opcional quando o fluxo interno do portal for suficiente, mas e recomendado para canal institucional externo.

## 3. Telas impactadas

- Aviso de privacidade: `/institucional/privacidade`
- Abertura de solicitacoes LGPD pelo titular: `/institucional/privacidade`
- Fila de analise RH/Admin: `/rh/lgpd`
- Limpeza com retencao de trilha de sessao: `/admin/limpeza-dados`

## 4. Validacao recomendada

### Titular

1. Entrar com usuario comum.
2. Abrir `/institucional/privacidade`.
3. Confirmar que o canal de contato aparece com os dados corretos.
4. Registrar uma solicitacao LGPD.
5. Confirmar que a solicitacao aparece no historico do titular.

### RH/Admin

1. Entrar com perfil RH ou Admin.
2. Abrir `/rh/lgpd`.
3. Confirmar que a solicitacao criada aparece na fila.
4. Alterar o status para `Em analise`, `Aprovada`, `Recusada` ou `Concluida`.
5. Confirmar que a auditoria da solicitacao foi registrada.

### PulseHub

1. Criar post com imagem.
2. Enviar anexo em mensagem direta.
3. Confirmar que ambos continuam abrindo normalmente apos o bucket privado.
4. Confirmar que links antigos publicos nao sao mais gerados para novos anexos.

### Retencao

1. Entrar em `/admin/limpeza-dados`.
2. Marcar `Limpar trilha de sessao antiga`.
3. Definir a janela de retencao em dias.
4. Executar e conferir o resultado na auditoria de limpeza.

## 5. Pendencias fora do codigo

Estes pontos ainda dependem de decisao juridica, administrativa ou de governanca:

- definir politica formal de retencao por categoria de dado
- validar base legal por modulo sensivel
- formalizar processo de resposta a incidente
- definir o responsavel/encarregado oficial e SLA de atendimento
- revisar dados sensiveis de RH e comportamento com criterio de necessidade

## 6. Risco residual atual

Mesmo com este pacote aplicado, a conformidade continua parcial se os itens abaixo nao forem tratados:

- ausencia de politica formal de retencao completa
- ausencia de rito formal de incidente
- ausencia de base legal documentada por processo
- eventual permanencia de dados historicos antigos fora das novas regras
