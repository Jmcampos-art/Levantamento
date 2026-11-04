# WALP Enterprise 4.0 — correção de deploy

## Por que o Render falhou
O backend já possui o script `npm start` no arquivo `backend/package.json`. O erro de script ausente costuma ocorrer quando o Render executa `npm start` na pasta errada. Este ZIP foi reorganizado para colocar `backend/` na raiz do repositório.

## GitHub
Envie o **conteúdo extraído** deste ZIP para a raiz do repositório, mantendo a pasta `backend` (não envie apenas o ZIP).

## Render > Settings > Build & Deploy
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Runtime: Node
- Instance: Free (se disponível)
- Health check: `/health`

Alternativamente, ao criar serviço novo, use o `render.yaml` na raiz como Blueprint. Não é necessário usar as duas formas.

## Environment (somente no Render)
- `FIREBASE_DATABASE_URL`: URL completa do seu Realtime Database.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON completo da conta de serviço Firebase. **Nunca envie ao GitHub, Netlify ou a terceiros.**
- `ALLOWED_ORIGINS`: URL exata do site Netlify, sem barra final. Para mais de uma origem, separe por vírgula.

Depois do deploy, abra `https://SEU-SERVICO.onrender.com/health`. Deve mostrar `{"status":"ok"}`.

## Netlify
Edite `config.js`:
`window.WALP_API_URL = 'https://SEU-SERVICO.onrender.com/api';`
Depois publique o frontend no Netlify.

## Segurança
Não publique as regras do banco novo sobre o banco de produção antes de fazer backup e testar a migração. O backend ainda tem pendências de robustez de movimentações e autenticação; não use em produção com estoques reais sem homologação.
