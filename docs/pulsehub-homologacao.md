# Homologacao do PulseHub

Este checklist cobre a validacao manual do pacote atual do `PulseHub`.

## 1. Preparacao

- usuario comum autenticado
- usuario `rh` ou `admin`
- usuario `diretoria` ou `admin`
- migrations do PulseHub aplicadas

## 2. Feed e publicacoes

1. Abrir `/institucional/rede-social`.
2. Criar uma publicacao social simples.
3. Criar uma publicacao com imagem.
4. Criar uma publicacao com video.
5. Confirmar exibicao no feed.
6. Confirmar comentario e reacao.

## 3. Comunicados e campanhas

1. Entrar com `rh`, `admin` ou `diretoria`.
2. Criar um `Comunicado oficial`.
3. Criar uma `Campanha interna`.
4. Confirmar badges de tipo no feed.
5. Confirmar entrada na central de notificacoes dos destinatarios.

## 4. Mencoes, hashtags e salvos

1. Criar um post com `@handle`.
2. Confirmar link para o perfil mencionado.
3. Criar um post com `#assunto`.
4. Clicar na hashtag.
5. Salvar um post.
6. Confirmar filtro `Salvos`.

## 5. Perfil e destaques

1. Validar cards de aniversariantes.
2. Validar cards de novos membros.
3. Abrir perfil de um membro pela rede.
4. Confirmar exibicao de `@handle`.

## 6. Comunidades

1. Abrir a aba `Comunidades`.
2. Entrar em uma comunidade.
3. Publicar com escopo `Comunidade`.
4. Confirmar exibicao no feed da comunidade.
5. Sair da comunidade.

## 7. Enquetes

1. Criar post com enquete.
2. Confirmar exibicao das opcoes.
3. Votar em uma opcao.
4. Confirmar contagem de votos.

## 8. Mensagens e notificacoes

1. Enviar mensagem direta com texto.
2. Enviar mensagem com anexo.
3. Confirmar notificacao de nova mensagem.
4. Marcar notificacoes como lidas.

## 9. Moderacao

1. Denunciar uma publicacao com usuario comum.
2. Entrar com `admin`, `rh` ou `diretoria`.
3. Abrir a fila de moderacao em `Comunidades`.
4. Marcar denuncia como `Em analise`.
5. Resolver ou descartar a denuncia.
6. Ocultar uma publicacao.
7. Confirmar que usuario comum nao ve mais a publicacao.
8. Restaurar a publicacao.

## 10. Home e analytics

1. Validar painel de analytics na aba inicial.
2. Validar bloco de comunicados recentes.
3. Validar assuntos em alta.
4. Validar autores com mais publicacoes.

## 11. Resultado esperado

Homologacao aprovada quando:

- feed, comunidades, enquetes e notificacoes funcionam
- roles de governanca conseguem moderar
- publicacoes ocultas deixam de aparecer para usuarios comuns
- build e lint permanecem verdes no projeto
