# USBRIN ID — Auditoria de segurança e critérios de homologação (18/11/2026)

## Escopo e fontes de verificação
Inspeção somente leitura do repositório `usbrin/usbrin-site`, branch `ops/usbrin-id-qa-deploy`, dos projetos Cloudflare Pages `usbrin-id-oidc-qa` e `usbrin-partners-qa`, das políticas do Cloudflare Access e dos metadados de banco D1. Nenhum login real, mudança de configuração de autenticação, manipulação de candidaturas ou deploy de produção foi executado nesta auditoria.

O repositório contém os fluxos de sessão (`functions/_lib/portal-session.js`), autenticação (`functions/_lib/auth.js`), formulários, testes de APIs e migração `0016_portal_sessions.sql`.

## Achados confirmados
1. **QA OIDC presente, porém sem sessão experimental ativada.** Em `usbrin-id-oidc-qa`, `USBRIN_SESSION_EXPERIMENT=false`. O fluxo de criação/expiração/encerramento de sessão existe no código, mas não é obrigatório nesse ambiente. `usbrin-partners-qa` tem `USBRIN_SESSION_EXPERIMENT=true`; suas inscrições gerais estão desativadas.
2. **O provedor ZITADEL OIDC está cadastrado no Access**, com políticas para identidades de QA. Tanto a aplicação OIDC principal quanto a rota de revalidação exigem o método de login OIDC (`login_method`). **Não possuem uma regra `Require → Authentication method → mfa` explícita.** Isso, isoladamente, NÃO demonstra ausência de MFA: o ZITADEL pode impor MFA ou a Cloudflare pode aplicar uma política de MFA independente. É obrigatório verificar a efetividade com uma sessão real antes de abrir acesso.
3. **Configuração global de MFA:** a organização permite TOTP, com duração de 15 minutos. Permitir o autenticador não é o mesmo que comprovar que ele é exigido nas aplicações QA. Não alterar políticas, identidade ou ZITADEL sem homologação e autorização.
4. **Banco D1 QA:** foram observadas as tabelas `users`, `portal_sessions` e `portal_session_challenges` nos bancos isolados `usbrin_id_oidc_qa` e `usbrin_partners_portal_qa`; isso não prova que a migração e os bindings estejam corretos para cada conta de teste, nem que os dados existentes sejam adequados.
5. **Proteção adicional para administrador no código:** `auth.js` exige que `ACCESS_MFA_AUD` corresponda à aplicação base, mas esse controle de configuração **não comprova por si só** o uso de MFA pelo provedor. A regra efetiva no IdP/Access deve ser inspecionada.
6. **Fluxo de publicação QA:** o workflow anterior copiava diretórios para `qa-deploy` sem executar os testes antes de publicar. O PR de correção usa `npm run build`, valida a separação entre `/public` e rotas privadas, verifica sintaxe, e roda os testes de integração. A publicação continua manual e restrita ao projeto QA.

## Gates para declarar USBRIN ID pronta
- [ ] Validar que cada conta de QA usa MFA TOTP efetivamente obrigatório, em especial administradores, sem exceções por política ou sessão reutilizada.
- [ ] Abrir o login pelo ambiente oficial de parceiros e verificar caminho até a URL do provedor, consentimento e retorno correto, sem páginas extras inesperadas.
- [ ] Validar administradores, representantes e desenvolvedores no ambiente correto, com dados sintéticos e permissões segregadas.
- [ ] Confirmar acesso negado: anônimo, e-mail não aprovado, usuário suspenso, JWT inválido, ação administrativa por não administrador e acesso entre parceiros.
- [ ] Ativar o controle de sessão **somente em QA autorizado**, testar prova de segundo fator recente, expiração por inatividade, logout, replay e renovação.
- [ ] Confirmar no ambiente QA a ausência de dados privados sob `/public`; garantir que páginas/rotas privadas exigem autenticação.
- [ ] Executar `node --test tests/partners-api.test.mjs`, `node --test tests/studio-pricing.test.cjs` e `npm run build` com resultados registrados.
- [ ] Homologar no desktop e no celular e aprovar explicitamente qualquer publicação fora de QA.

## Gates para campanha e candidaturas
- [ ] Manter `APPLICATIONS_ENABLED=false` até aprovação expressa.
- [ ] Revisar privacidade, consentimentos/bases legais, contratos e retenção dos dados.
- [ ] Validar Turnstile, inscrição controlada, duplicidades, consulta de protocolo e revisão administrativa.
- [ ] Garantir banco D1 separado para dados reais e nenhuma ativação automática de candidato sem aprovação e contrato.
- [ ] Publicar a campanha apenas depois de autorizar o lançamento.

## Limites do que foi validado
Os testes de integração utilizam banco SQLite e JWTs simulados; um resultado verde no GitHub não substitui o login humano com a identidade real no ZITADEL/Access. A revisão de configuração não demonstra que todos os caminhos públicos/privados respondem corretamente pela internet. Nenhum segredo de API, token de login ou dado pessoal deve ser copiado para relatórios, logs ou conversas.
