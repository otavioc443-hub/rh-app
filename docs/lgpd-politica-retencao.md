# Politica de Retencao e Descarte de Dados do Portal

Este documento define a referencia operacional de retencao para os dados tratados no portal.

Principios:

- reter apenas pelo tempo necessario para a finalidade
- conservar alem da finalidade apenas quando houver obrigacao legal, regulatoria ou exercicio regular de direitos
- restringir acesso durante a fase de retencao
- eliminar, anonimizar ou tornar indisponivel quando a finalidade cessar

Referencia legal:

- arts. 15 e 16 da LGPD

## Regras gerais

1. Sempre que houver prazo legal especifico superior, o prazo legal prevalece.
2. Sempre que houver litigio, auditoria, fiscalizacao ou investigacao em andamento, suspende-se o descarte do conjunto relacionado.
3. Dados mantidos apenas para seguranca, auditoria ou defesa devem ficar com acesso mais restrito que o dado operacional corrente.
4. Quando a eliminacao integral nao for possivel de imediato, o dado deve ser bloqueado, anonimizado ou retirado da visualizacao comum.

## Tabela de retencao

| Categoria | Exemplos no portal | Prazo operacional sugerido | Destino apos prazo | Observacoes |
| --- | --- | --- | --- | --- |
| Cadastro base de colaborador ativo | perfil, cargo, lotacao, contatos operacionais | durante o vinculo ativo | migrar para historico controlado ou atualizar | uso operacional continuo |
| Historico de colaborador desligado | dados funcionais e cadastrais de ex-colaborador | conforme obrigacao trabalhista, previdenciaria, fiscal e defesa de direitos | bloqueio, arquivo restrito ou eliminacao conforme matriz juridica | validar com juridico e contabilidade |
| Dados bancarios operacionais | banco, agencia, conta, pix | enquanto necessarios para pagamento vigente | remocao ou bloqueio quando cessar a finalidade | exibir mascarado por padrao |
| Solicitacoes cadastrais e anexos comprobatórios | alteracoes de dados, comprovantes anexados | 5 anos apos conclusao, salvo prazo legal superior | eliminacao ou arquivo restrito | revisar por tipo de documento |
| Chamados internos e anexos | tickets e arquivos associados | 2 anos apos encerramento | eliminacao ou anonimização | elevar prazo se houver risco juridico |
| Pagamentos extras e anexos | aprovacoes, comprovantes, anexos | 5 anos ou prazo fiscal/contabil aplicavel | arquivo restrito ou eliminacao | depende de natureza fiscal do anexo |
| CNAB, remessas e operacao financeira | configuracoes, arquivos de remessa, trilhas de pagamento | conforme exigencia bancaria/fiscal e defesa de direitos | arquivo restrito | nao deixar visivel em rotinas comuns |
| Notas fiscais e documentos fiscais | invoices, dados de integracao fiscal | prazo legal fiscal e contabil aplicavel | arquivo restrito | validar prazo com fiscal/contabil |
| Posts, comentarios e midia do PulseHub | publicacoes internas, reacoes, comentarios, imagens | enquanto houver finalidade institucional e vinculo ativo; revisar anualmente | exclusao mediante politica interna ou pedido valido | prever exclusao por encerramento de vinculo quando aplicavel |
| Mensagens internas e anexos | conversas e anexos em chat interno | 2 anos apos ultima interacao, salvo necessidade de seguranca ou investigacao | eliminacao ou bloqueio | revisar se a ferramenta e realmente necessaria para memoria longa |
| Avatar e imagem de perfil | foto de perfil | enquanto o perfil estiver ativo | exclusao ou substituicao ao desligamento | bucket privado |
| Sessao e trilha de seguranca | session audit, user agent, eventos de sessao | 180 dias por padrao | eliminacao automatica/administrativa | prazo ja implementado no portal |
| Auditorias administrativas | logs de aprovacao, decisao e alteracao | 5 anos ou enquanto necessario para defesa de direitos | arquivo restrito | exibir sempre em forma resumida |
| Solicitacoes LGPD e auditoria da solicitacao | pedidos do titular, andamentos e decisoes | 5 anos apos encerramento | arquivo restrito | necessario para prova de atendimento |
| Conteudo institucional corporativo | logos, banners, pecas institucionais | enquanto vigente institucionalmente | substituicao ou descarte | pode permanecer publico se nao contiver dado pessoal |

## Descarte

O descarte deve seguir esta ordem:

1. verificar se ainda existe finalidade
2. verificar se existe obrigacao legal/regulatoria
3. verificar se existe litigio, incidente ou auditoria aberta
4. decidir entre eliminar, anonimizar, bloquear ou arquivar com acesso restrito
5. registrar a operacao quando envolver dado sensivel ou massa relevante

## Rotinas minimas

- revisao semestral de buckets, anexos e logs
- revisao trimestral das trilhas administrativas mais sensiveis
- limpeza periodica de `session_audit`
- revisao anual de PulseHub, mensagens e anexos internos
- checklist de desligamento de colaborador com exclusao/bloqueio do que nao precisa permanecer

## Donos do processo

- RH: dados de colaborador e solicitacoes cadastrais
- Financeiro: dados bancarios, fiscais, remessas e pagamentos
- Admin do portal: auditorias, sessao, buckets e limpeza operacional
- Encarregado/juridico: aprovacao final de prazo e excecoes
