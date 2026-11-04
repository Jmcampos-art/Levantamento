# WALP Enterprise 4.0 — Correção visual mobile

## Corrigido
- O CSS anterior aplicava `display:grid` a `.auth`, `#workspace` e formulários, sobrescrevendo o atributo HTML `hidden`. Agora `[hidden] { display: none !important; }` evita exibir login, dashboard e login administrativo simultaneamente.
- O link de acesso administrativo agora alterna o texto para permitir voltar ao acesso do funcionário.
- Ajustes de espaçamento e altura em dispositivos móveis.

## Atenção: integração ainda pendente
- `enterprise.js` aponta para Firebase Cloud Functions (`asia-southeast1-levantamento-epi.cloudfunctions.net/api`), incompatível com a implantação planejada no Firebase Spark.
- Para funcionar no Spark, é necessário implementar e publicar um backend externo seguro (Render ou alternativa), substituir a constante `API` no `enterprise.js` e configurar as credenciais do Firebase Admin SDK apenas no servidor.
- Não publique regras novas no banco de produção nem substitua o projeto antigo antes de migrar e testar os dados.
- Esta atualização corrige a apresentação das telas, não completa a autenticação nem valida a segurança do sistema em produção.
