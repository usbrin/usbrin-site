# USBRIN ID — login da própria USBRIN com ZITADEL no backend (19/11/2026)

## Experiência
A tela da USBRIN continua sendo `login.html`, com e-mail e senha. Não exige redirecionamento cotidiano para Cloudflare Access ou para a página do ZITADEL. O ZITADEL passa a fazer a validação de identidade pela **Session API v2** usando credenciais mantidas exclusivamente pelo próprio provedor.

A conta e suas permissões de negócio permanecem na base USBRIN. Somente identidades ativas, aprovadas e **explicitamente vinculadas por ID ZITADEL** podem abrir sessão local. A vinculação **não é automática por e-mail**.

## Fonte oficial
- Sessão com usuário: `POST /v2/sessions` (`checks.user.loginName`)
- Senha: `PATCH /v2/sessions/{sessionId}` (`checks.password.password`)
- Fatores validados: `GET /v2/sessions/{sessionId}`
- Encerramento: `DELETE /v2/sessions/{sessionId}`
- Documentação: `https://zitadel.com/docs/guides/integrate/login-ui/username-password`
- Verificação explícita de fatores: `https://zitadel.com/docs/guides/integrate/login-ui/session-validation`
- Login client: `https://zitadel.com/docs/guides/integrate/login-ui/login-app`

## Branch e alterações preparadas
Branch `feature/usbrin-id-zitadel-custom-ui-20261119` (PR #12 em rascunho, derivada do PR #11).

- `functions/_lib/zitadel-auth.js`: cliente de servidor com origem fixa do ZITADEL, token protegido por ambiente, validação explícita dos fatores `user` e `password`, rate limiting e integração com D1.
- `functions/_lib/auth.js` e `functions/_middleware.js`: autorização backend e proteção de páginas/ativos privados para o modo `zitadel`.
- `functions/api/native/login.js` e `logout.js`: aproveitam o formulário próprio existente; apenas o backend de verificação muda.
- `migrations/0019_zitadel_identity_sessions.sql`: vinculação de identidade, sessões locais revogáveis e limitação de tentativas de login.
- `functions/api/native/config.js` e `js/login.js`: o formulário não anuncia recuperação de senha nativa quando o ZITADEL está em uso.
- `tests/zitadel-auth.test.mjs`: testes com ZITADEL simulado (sem chamadas reais ou credenciais).

## Segurança
- O login permite apenas o host QA configurado e o URL fixo do ZITADEL detectado no ecossistema USBRIN.
- O serviço de login usa `ZITADEL_LOGIN_CLIENT_TOKEN` somente no servidor; não é exposto no HTML, cookie ou código público.
- Não armazena senha ZITADEL ou o token da sessão externa no D1. A sessão USBRIN usa cookie aleatório com `Secure`, `HttpOnly`, `SameSite=Lax`; apenas o digest SHA-256 é persistido no D1.
- Expiração absoluta local de 2 horas, 30 minutos de inatividade, verificação da sessão ZITADEL a cada 5 minutos e negação se o provedor estiver indisponível no momento da revalidação.
- Exige vínculo entre ID ZITADEL e usuário local aprovado, impedindo conta de outra origem de ganhar direitos por e-mail semelhante.
- Administradores **exigem MFA válido**; um login só com senha retorna `mfa_required` e **não concede sessão**. A etapa adicional de TOTP dentro da USBRIN precisa ser finalizada antes de homologar o perfil administrador.
- Inscrições permanecem desligadas.

## Estado real da homologação — atualização de 19/11/2026

**Confirmado no GitHub, Cloudflare e ZITADEL:**
- Pages QA isolado `usbrin-id-native-qa.pages.dev` publicado com `USBRIN_AUTH_MODE=zitadel` e `ZITADEL_API_URL` fixo do provedor; `ZITADEL_LOGIN_CLIENT_TOKEN` armazenado na Cloudflare como **Secret** e nunca consultado/exposto em código, logs ou no chat.
- Conta técnica `usbrin-id-login-qa` criada pela administração ZITADEL, com **somente IAM_LOGIN_CLIENT**, sem IAM_OWNER. Token PAT com expiração informada em **19/12/2026**; definir renovação/rotação antes dessa data.
- D1 QA `usbrin_id_native_qa` migrado até 0019, sem usuários, vínculos ou sessões reais. A identidade **sintética** usada no smoke test foi eliminada ao final; contagem pós-limpeza: zero usuários, vínculos e sessões.
- HTTP real do QA: `/login` 200; `/portal` 302 sem sessão; `/js/portal.js` e `/api/private/me` 401 sem autenticação.
- O erro inicial 503 era **incompatibilidade do runtime Cloudflare Workers com `fetch(...,{redirect:"error"})`**, conforme documentação oficial Cloudflare. O código usa agora `redirect:"manual"` e bloqueia explicitamente respostas 3xx para impedir qualquer encaminhamento do token de serviço.
- Após correção, teste temporário não autenticado do backend ao ZITADEL retornou **HTTP 404 para uma sessão inexistente** (esperado), enquanto o documento público de OIDC retornou **HTTP 200**. Uma tentativa de login usando identidade e senha totalmente fictícias recebeu **HTTP 401**, rejeição adequada. A execução automatizada foi aprovada: `https://github.com/usbrin/usbrin-site/actions/runs/44461702227`.
- O endpoint temporário de diagnóstico foi **retirado do código** e o QA foi republicado pelo job de limpeza. Não há API de diagnóstico persistida na branch.
- Testes de componentes, integração simulada, controle de acesso e regressões do USBRIN Studio continuam obrigatórios.
- O site oficial `usbrin.com.br`, Cloudflare Access legado, os usuários reais e a campanha de representantes **não foram alterados**.

**O que esses testes NÃO comprovam:** login com uma conta real do ZITADEL, definição/recuperação de senha do provedor, MFA administrativo, vinculação real de identidade ou onboarding de representante. São gates obrigatórios antes de liberar acesso.

## Próximos passos de homologação

1. Criar **contas de teste sem dados de clientes** no ZITADEL com política explícita de senhas, validação de e-mail e, quando necessário, segundo fator.
2. No D1 QA, registrar usuários aprovados de QA e seus IDs ZITADEL por vínculo explícito (nunca por correspondência de e-mail isolada). Validar representação, desenvolvimento, suspensão e logout.
3. Finalizar o primeiro acesso/recuperação de senha usando APIs oficiais do ZITADEL, evitando manter senhas no D1 local e sem criar conta ativa na inscrição.
4. Criar etapa visível de MFA/TOTP dentro da experiência USBRIN para administradores, preservando a tela de e-mail/senha para os demais perfis.
5. Validar limites de abuso e custos/plano, revisar autorização por perfil, testar desktop/mobile, confirmar retenção e rollback.
6. Apenas depois de homologação e **aprovação expressa**, integrar à rota oficial do site e planejar a abertura das candidaturas.

## Etapa adicional validada — TOTP administrativo e recuperação (19/11/2026)

- Administradores agora usam a **mesma página de login da USBRIN**. Após e-mail e senha corretos, a interface exibe o campo de TOTP. A sessão e o cookie da aplicação só são emitidos depois que o ZITADEL confirma o fator de senha **e** o TOTP; uma senha sem segundo fator não concede acesso.
- Representantes e desenvolvedores continuam com e-mail e senha, sem a etapa administrativa extra.
- Primeiro acesso e recuperação de senha foram preparados via API oficial ZITADEL `/v2/users/{id}/password_reset` e `/v2/users/{id}/password`, com o mesmo `senha.html`; não são armazenados hashes de senha no D1. O código só opera para contas aprovadas, previamente vinculadas por ID de usuário, e inclui limites de tentativas.
- O mecanismo de recuperação exige `ZITADEL_PASSWORD_RESET_ENABLED=true`. **No QA a variável está explicitamente `false`** até confirmar que o ZITADEL consegue enviar notificações e que o link enviado ao endereço de teste funciona. Nenhum e-mail foi disparado.
- Testes automatizados do login, TOTP, recuperação, autorização do portal e regressões do Studio: [CI 44463773533](https://github.com/usbrin/usbrin-site/actions/runs/44463773533) aprovado.
- Implantação isolada [44463895219](https://github.com/usbrin/usbrin-site/actions/runs/44463895219) aprovada.
- Smoke HTTP após implantação [44464020586](https://github.com/usbrin/usbrin-site/actions/runs/44464020586) aprovado: login com HTML do campo TOTP, rotas privadas protegidas, reset não habilitado (HTTP 404), nenhum endpoint temporário de diagnóstico aceitando POST.
- Inspeção pós-deploy: banco D1 QA com **0 usuários, 0 vínculos, 0 sessões e 0 tentativas de recuperação**; token ZITADEL armazenado como secret, `APPLICATIONS_ENABLED=false`, `fail_open=false`.
- **Não homologado ainda:** login de conta legítima de teste, TOTP real de administrador, entrega de e-mail do ZITADEL, redefinição com código real, suspensão/revogação em navegador e experiência mobile. São necessários dados e identidade de teste aprovados e distintos do administrador principal do ZITADEL; não usar a senha da conta que administra toda a instância para validar um protótipo.

## Pendências antes do lançamento de representantes
- [ ] Serviço ZITADEL com permissões suficientes e custo/plano revistos, sem contratar nada automaticamente
- [ ] Homologação real do login pelo backend de QA (não apenas mocks)
- [ ] Primeiro acesso e recuperação de senha realizados pelo provedor ZITADEL; **o fluxo anterior de reset local não é usado** neste modo
- [ ] MFA administrativo implementado dentro da experiência USBRIN
- [ ] Processo auditado de criação/vínculo de identidades após aprovação e contrato
- [ ] WAF, bloqueio contra abuso, limites de provedores e procedimento de rotação de credenciais
- [ ] Regressões mobile/desktop, acessibilidade e rollback
- [ ] Aprovação expressa para integrar ao site oficial e abrir inscrições

**Nenhuma alteração de produção ou da identidade anterior é autorizada por este documento.**
