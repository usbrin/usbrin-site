# USBRIN ID — login próprio (homologação isolada)

## Experiência definida
O acesso cotidiano da USBRIN ID será feito dentro do site, em uma página com **e-mail e senha**, sem redirecionamento para ZITADEL ou Cloudflare Access. A Cloudflare permanece na hospedagem e na segurança de rede. O portal existente e suas permissões por perfil serão preservados.

- **Entrar:** `login.html` → `/api/native/login` → `/portal`.
- **Primeiro acesso:** `senha.html`, informar e-mail já aprovado → link enviado ao endereço cadastrado → definir senha → entrar.
- **Esqueceu a senha:** o mesmo fluxo de `senha.html`; o link não revela se uma conta existe e expira em **20 minutos**.
- **Logout:** `/api/native/logout`, invalidando a sessão no servidor.
- **Candidatos ainda não aprovados:** não podem definir senha nem acessar o portal.

O fluxo de e-mail é **transacional**, jamais uma inscrição pública de contas.

## Implementação concluída apenas no código
- Identidade visual própria em `login.html`, `senha.html`, `css/login.css`, `js/login.js` e `js/senha.js`.
- `native-auth.js`: hashes PBKDF2-SHA256 com 600.000 iterações, salt distinto para cada senha e segredo de ambiente `USBRIN_PASSWORD_PEPPER`; nenhum texto de senha é armazenado no banco, frontend ou GitHub.
- Tokens de sessão aleatórios de 256 bits, armazenados apenas por hash no D1; cookie `Secure; HttpOnly; SameSite=Lax`, até 12h de validade e 30 minutos de inatividade.
- Controles de origem nas chamadas POST, bloqueio de tentativas repetidas, cancelamento de sessão, suspensão de contas e isolamento de perfis por autorização no backend.
- `native-password.js`: tokens aleatórios de uso único, salvos somente como hash; validade de 20 minutos, limites por endereço e IP; definição/redefinição de senha com invalidação das sessões anteriores.
- Link de recuperação via fragmento `#token=…` (o token não faz parte do caminho ou query enviados ao servidor) e limpeza imediata do fragmento no navegador.
- Comunicação por `POST https://api.resend.com/emails` **somente se habilitada em ambiente privado**, após a conta USBRIN ter um remetente verificado. O código não envia e-mail se o provedor estiver desconfigurado ou desativado.
- Migrações aditivas `0017_native_credentials.sql` e `0018_native_password_links.sql`, **não aplicadas em nenhum banco real nesta entrega**.
- O modo novo é opt-in e isolado: `USBRIN_AUTH_MODE=native`. O login antigo permanece disponível nos ambientes existentes até homologação.

## Configuração mínima de um ambiente de testes independente
Os nomes abaixo são referências operacionais: não copiar valores de demonstração para o site real, não publicar segredos e não usar os bancos atuais de produção.

| Variável ou binding | Tipo | Uso |
| --- | --- | --- |
| `USBRIN_AUTH_MODE=native` | string QA | Opt-in explícito |
| `NATIVE_AUTH_HOST` | string QA | Host HTTPS exato do ambiente nativo isolado |
| `USBRIN_ID_DB` | D1 binding QA | Banco exclusivo com migrações 0001 a 0018 aplicáveis |
| `USBRIN_PASSWORD_PEPPER` | secret_text | Segredo forte e aleatório, exclusivo do ambiente |
| `USBRIN_PASSWORD_EMAIL_ENABLED=true` | string QA | Habilita envio de links apenas após validação |
| `RESEND_API_KEY` | secret_text QA | Credencial restrita de envio transacional |
| `USBRIN_EMAIL_FROM` | string QA | Remetente de domínio previamente verificado |

**Não configurar nem enviar e-mails até validar domínio, custos/limites do provedor e dados de QA.** O serviço externo de envio precisa ser avaliado antes de qualquer contratação. Não usar e-mails fictícios ou candidaturas reais em testes.

## Como liberar o primeiro administrador
1. Confirmar **fora do chat** que o e-mail administrativo no D1 QA foi verificado pelo proprietário e que seu registro `users` está `active`.
2. Preparar novo host Pages QA exclusivo para login próprio, sem o Access interceptando `/login`, `/senha` ou `/api/native/*`. Não modificar a proteção existente em `usbrin-id-oidc-qa`.
3. Aplicar migrações novas **somente no novo banco QA**, e configurar os segredos por variáveis protegidas do Cloudflare Pages; não gerar senhas ou links no GitHub.
4. Validar o remetente transacional e ativar o envio **somente QA**.
5. O administrador acessa `/senha.html` e solicita o primeiro link usando o e-mail já aprovado. A senha é definida apenas pelo proprietário no próprio site. Não existe senha padrão.
6. Testar login, autorização financeira, bloqueio após suspensão, recuperação, logout e acesso em celular/desktop com dados sintéticos.

## Critérios pendentes para homologação
- [ ] Criar e configurar QA independente **sem afetar o Access atual**.
- [ ] Validar provedor transacional, remetente e entrega real com e-mail autorizado.
- [ ] Testar fluxo completo em browser com pelo menos três perfis e contas suspensas, incluindo CSP, logs e proteção de rotas.
- [ ] Adicionar defesa de borda contra tentativas automatizadas e revisar o risco do administrador (que manipula dados sensíveis e financeiros).
- [ ] Revisar retenção de tokens, auditoria e procedimento operacional de recuperação/roll-back.
- [ ] Aprovação expressa antes de ativar o modo nativo ou modificar DNS, produção ou autenticação legada.

## Candidaturas e campanha
`APPLICATIONS_ENABLED=false` segue sendo o padrão. O candidato não recebe conta ativa durante a inscrição. Só pessoas aprovadas, com documentação e contrato já conferidos pela administração, terão o e-mail ativado para criação de senha.

## Testes automatizados
Na branch `feature/usbrin-id-login-proprio-20261118`, os testes de identidade nativa verificam criação e troca de senha, consumo único e expiração de links, perfil autorizado, CSRF, limite de tentativas, revogação de sessões e suspensão. Os outros testes existentes do portal, USBRIN Studio e build continuam obrigatórios na CI.

**Estado real:** código e testes preparados; não há implantação do login nativo, migração D1 real, envio de e-mail nem homologação ponta a ponta nesta entrega.
