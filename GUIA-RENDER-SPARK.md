# WALP 4.0 — Render + Firebase Spark + Netlify

## Correções incluídas
- Marca W**A**LP em todas as telas, sem losango.
- Erro `Failed to fetch` tratado com mensagem útil.
- Backend Express compatível com Render, separado de Cloud Functions.
- `config.js` para URL da API.

## Implantação segura (primeiro em projeto de testes)
1. Faça backup do Realtime Database e das regras atuais do Firebase. Não substitua o banco de produção.
2. No Firebase Console, habilite Authentication > E-mail/senha e crie o usuário administrador.
3. Em Configurações do projeto > Contas de serviço, gere a chave JSON de uma conta de serviço **apenas para o backend**. Não publique esse arquivo no GitHub nem no Netlify.
4. No Render, crie Web Service Node.js apontando para `Levantamento-main/backend` (Root Directory), Build Command `npm install`, Start Command `npm start`. Configure `FIREBASE_SERVICE_ACCOUNT_JSON` com o conteúdo JSON em uma variável secreta; `FIREBASE_DATABASE_URL` e `ALLOWED_ORIGINS` com a URL exata do frontend (sem barra final). Nunca exponha a chave.
5. Teste `https://SEU-SERVICO.onrender.com/health` (deve responder status ok).
6. Edite `Levantamento-main/config.js`: `window.WALP_API_URL = 'https://SEU-SERVICO.onrender.com/api';`.
7. Publique o conteúdo de `Levantamento-main` no Netlify. A URL de `ALLOWED_ORIGINS` deve corresponder exatamente ao domínio real.
8. Para autorizar o primeiro administrador, grave no banco de testes `admins/UID_DO_USUARIO/active = true` (boolean), usando o UID do Authentication.
9. Antes de operar com dados reais, conclua a migração dos dados antigos, testes de permissões e endurecimento do backend.

## Limitações de segurança ainda pendentes
- O controle de tentativas é em memória e não é suficiente em produção com reinícios ou múltiplas instâncias.
- O fluxo de movimentações usa transação para saldo, mas o registro de histórico não é atômico com a alteração do saldo; pode haver divergência em falhas.
- O painel de permissões e a redefinição de código secreto ainda não têm interface completa.
- A sessão do operador precisa de expiração/revogação adicional e regras adequadas no Firebase.
- O projeto não deve substituir a operação real antes de homologação, backup e testes de concorrência.
- Serviços gratuitos podem suspender e não oferecem SLA corporativo.
