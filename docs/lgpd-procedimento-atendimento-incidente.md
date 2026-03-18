# Procedimento de Atendimento LGPD e Resposta a Incidente

Este documento define o rito minimo para:

- atendimento de direitos do titular
- tratamento de incidente de seguranca com dados pessoais

## 1. Papéis

- `Titular`: pessoa que faz a solicitacao ou foi impactada pelo incidente
- `Encarregado`: canal oficial com titular e ANPD
- `RH`: trata demandas de cadastro funcional e historico de colaborador
- `Financeiro`: trata demandas financeiras, fiscais e bancarias
- `Admin do portal`: apoia evidencias tecnicas, logs, buckets e acessos
- `Desenvolvimento`: corrige falha tecnica e preserva evidencias
- `Juridico/consultoria`: valida base legal, excecao e comunicacao formal quando necessario

## 2. Atendimento de direitos do titular

### Tipos de solicitacao

- confirmacao de tratamento
- acesso aos dados
- correcao de dado incompleto, inexato ou desatualizado
- anonimização, bloqueio ou eliminacao quando cabivel
- portabilidade, quando aplicavel
- informacao sobre compartilhamento
- revisao de decisao automatizada, quando aplicavel
- oposicao ou revogacao, quando a base permitir

### Canais

- pagina de privacidade do portal
- canal oficial do encarregado
- canal institucional externo, se adotado

### Fluxo operacional

1. Receber a solicitacao e registrar numero/protocolo.
2. Validar identidade do titular e escopo do pedido.
3. Classificar o pedido por area:
   - RH
   - Financeiro
   - Admin
   - juridico/encarregado
4. Confirmar recebimento ao titular.
5. Levantar os dados e sistemas envolvidos.
6. Responder imediatamente quando a confirmacao for simples.
7. Quando nao for possivel responder de imediato, concluir resposta formal em ate 15 dias.
8. Registrar decisao, fundamento e evidencias.
9. Fechar a solicitacao com status final e trilha de auditoria.

### SLA interno recomendado

- recebimento e triagem: ate 1 dia util
- validacao de identidade: ate 2 dias uteis
- consolidacao da resposta: ate 10 dias uteis
- margem de aprovacao final/encarregado: ate 15 dias corridos no total

### Evidencias minimas

- data e hora do pedido
- canal de entrada
- identidade validada
- responsavel pelo tratamento
- dados consultados
- decisao final
- resposta enviada

## 3. Resposta a incidente com dados pessoais

### O que conta como incidente

- acesso indevido
- vazamento ou exposicao publica
- perda, alteracao ou exclusao indevida
- envio a destinatario errado
- falha de bucket, permissao, URL ou anexo
- indisponibilidade com impacto relevante sobre dados pessoais

### Fluxo de resposta

1. Identificacao
   - qualquer area abre chamado de incidente imediatamente
2. Contencao
   - bloquear acesso
   - revogar URL/token
   - desativar fluxo afetado
   - preservar evidencias tecnicas
3. Classificacao inicial
   - quais dados foram afetados
   - quantidade de titulares
   - periodo
   - risco ou dano relevante
4. Escalonamento
   - Admin + Desenvolvimento
   - Encarregado
   - Juridico
   - diretoria, se relevante
5. Correcao
   - ajustar regra, bucket, policy, fluxo ou tela
6. Comunicacao
   - se houver risco ou dano relevante, preparar comunicacao a ANPD e ao titular nos termos aplicaveis
7. Encerramento
   - registrar causa raiz
   - registrar medida corretiva
   - registrar acoes preventivas

### Janela interna recomendada

- registro inicial: imediato
- classificacao preliminar: ate 24 horas
- decisao de comunicacao: ate 48 horas
- preparacao da comunicacao externa: conforme regulamento aplicavel e decisao do encarregado/juridico

## 4. Checklist de incidente

- data e hora da deteccao
- sistema/modulo afetado
- origem do incidente
- categoria de dados envolvida
- quantidade estimada de titulares
- medidas de contencao adotadas
- risco avaliado
- necessidade de comunicar titular
- necessidade de comunicar ANPD
- responsavel tecnico
- responsavel funcional
- data de encerramento

## 5. Padrão de registro

Todo atendimento LGPD e todo incidente relevante devem ter:

- identificador unico
- dono do caso
- timeline
- fundamento/decisao
- evidencia
- pendencia de follow-up

## 6. Revisão periódica

- revisar este procedimento a cada 6 meses
- revisar apos qualquer incidente relevante
- revisar apos criacao de modulo novo de alto impacto

## 7. Ligação com o portal

Este procedimento conversa diretamente com:

- pagina de privacidade do portal
- fila de solicitacoes LGPD
- trilhas administrativas
- limpeza de sessao e auditoria
- politicas de bucket e anexos
