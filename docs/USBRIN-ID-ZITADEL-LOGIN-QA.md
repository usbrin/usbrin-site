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

## Estado real da homologação
- Cloudflare Pages de teste: `usbrin-id-native-qa.pages.dev` — continua publicado no modo **`native`**, não no novo modo `zitadel`.
- D1 exclusivo `usbrin_id_native_qa`: migrações 0001–0019 aplicadas, sem registros de usuários reais e sem vínculos ZITADEL.
- Nenhum PAT ZITADEL foi configurado e nenhum login real foi executado nesta integração.
- Os testes unitários e de API rodam no GitHub Actions, mas utilizam **respostas simuladas** da Session API; não atestam o funcionamento com contas reais.
- Cloudflare Access existente, site oficial e campanha de representantes **não foram alterados**.

## Configuração que depende da administração ZITADEL
**Nunca copiar tokens ou senhas para o chat ou para o GitHub.**

1. No console da instância `usbrin-id-rzf8mn.us1.zitadel.cloud`, criar (ou reutilizar cuidadosamente) uma **conta de serviço dedicada ao login customizado**, de acordo com a documentação do ZITADEL.
2. Conceder exclusivamente o necessário para as operações de sessão do Login Client (a documentação cita o papel `IAM_LOGIN_CLIENT`); verificar permissões `session.write` e `session.read`, sem conceder `IAM_OWNER` à aplicação sem necessidade. Emitir um PAT ou outro método de autenticação M2M apropriado; definir prazo e rotação.
3. No Cloudflare Pages **somente** do projeto `usbrin-id-native-qa`, cadastrar o segredo `ZITADEL_LOGIN_CLIENT_TOKEN` como **Secret**, nunca Plain Text, na configuração de homologação.
4. Após confirmar a configuração, a equipe técnica poderá definir `ZITADEL_API_URL=https://usbrin-id-rzf8mn.us1.zitadel.cloud` e `USBRIN_AUTH_MODE=zitadel`, apenas no QA. Não ativar antes da confirmação das credenciais e das políticas.
5. Provisionar *contas sintéticas de homologação* no ZITADEL e D1 com vínculo explícito de IDs; nenhum usuário ou senha real precisa ser compartilhado.
6. Testar sessão real de representante/desenvolvedor, fatores, senha errada, bloqueio da conta e logout. Completar MFA administrativo e políticas antes de publicar fora do QA.

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
