# WALP Enterprise 4.0 — implementação inicial, NÃO pronta para produção

## O que foi preservado
Os arquivos `legacy-index.html`, `legacy-script.js`, `legacy-style.css` são cópias do projeto original. `script.js` e `style.css` originais também permanecem. Nenhum dado do Firebase foi modificado por este pacote.

## Como testar em ambiente separado
1. Faça backup integral do Realtime Database atual no Firebase Console (exportar JSON), e backup das regras atuais.
2. Crie um projeto Firebase **de testes** com Authentication (e-mail/senha e custom tokens via Admin SDK), Realtime Database e Cloud Functions. A configuração no `enterprise.js` e URL da função precisam ser adaptadas para testes.
3. Execute `npm install` na pasta `functions` e instale o Firebase CLI; faça deploy com `firebase deploy --only functions,database` somente no projeto de testes. Cloud Functions podem exigir plano Blaze com faturamento ativado, mesmo em uso baixo.
4. Crie manualmente no Authentication um usuário administrador e registre `admins/<UID> = {"active":true}` no Realtime Database pelo Console (não pelo frontend). Nunca conceda acesso admin por formulário público.
5. Crie filial via painel admin; depois contêiner (branchId da filial); funcionário com PIN e matrícula; configure `permissions/<employeeId>/<containerId> = true` via console até existir interface de permissões.
6. Configure código secreto via endpoint administrativo `adminSetAccess` com token Firebase ID do admin; **não** coloque esse código em arquivos públicos. A função exige no mínimo 16 caracteres.
7. Faça importação controlada dos registros antigos após mapear cada contêiner à sua filial e validar campos, IDs e quantidades. Não rode uma migração automática em produção.
8. Publique os arquivos estáticos no Netlify só depois de testar regras, autenticação, CORS e operações concorrentes.

## Limitações críticas ainda pendentes
- Este pacote é uma **base de desenvolvimento**, não um sistema empresarial finalizado.
- Não há migração automatizada, painel de concessão de permissões, rotação de códigos no frontend, edição de registros, relatórios completos, consulta paginada de auditoria ou aprovação transacional de ajustes de inventário.
- O bloqueio de tentativas usa memória da instância e NÃO funciona de maneira distribuída; configurar App Check e proteção na borda/serviço de rate limit antes de produção.
- Movimentações usam transação no produto, mas gravação do histórico ocorre em etapa separada: uma falha intermediária pode deixar histórico incompleto. Requer reconciliação e arquitetura de ledger/command idempotente para integridade auditável.
- A verificação do código de contêiner usa SHA-256. Para códigos gerados aleatoriamente de alta entropia é aceitável como índice, mas códigos humanos de baixa entropia exigem proteção adicional, como HMAC com segredo no backend.
- A função administrativa de gravação precisa de validação de esquema rigorosa e regras de negócio adicionais; o painel atual não deve ser usado com dados reais antes disso.
- Tokens Firebase podem continuar válidos por algum tempo após encerramento; operações fazem revalidação de permissão, mas revogação imediata de todas as sessões requer lógica adicional.
- As regras `database.rules.json` negam acesso direto a TODOS os clientes; se aplicadas ao banco de produção, o sistema antigo deixará de funcionar. Nunca publique essas regras antes de concluir a migração e a substituição do frontend.
- Os dados legados podem usar formatos distintos (`quantidade`, `nome`, `containerId`); precisam de validação antes de operações reais.
- A implantação de Cloud Functions e alguns recursos de segurança podem exigir faturamento.

## Arquivos
- `index.html`, `enterprise.css`, `enterprise.js`: interface inicial.
- `functions/index.js`: endpoints protegidos (protótipo).
- `database.rules.json`: bloqueio de leitura e escrita direta.
- `legacy-*`: arquivos originais de referência.
