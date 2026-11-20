# USBRIN ID e campanha — plano de liberação segura

**Estado: preparação somente. Não publicar em `usbrin.com.br` nem abrir inscrições sem aprovação expressa.**
Revisão técnica: 19/11/2026. Branch da release: `feature/usbrin-lancamento-integrado-qa-20261119`; PR #15 em rascunho.

## 1. Estado verificado no ambiente
- O Pages `usbrin-site` atende `usbrin.com.br`, com produção em `feature/usbrin-studio-mvp`. Em 19/11/2026, não há binding `USBRIN_ID_DB` nem variáveis de autenticação na configuração de produção, e `fail_open=true`. **A produção atual não está pronta para hospedar as rotas privadas do novo sistema.**
- O Pages `usbrin-id-native-qa` tem `USBRIN_AUTH_MODE=zitadel`, binding D1 e token protegido; o login real de um representante foi homologado no QA. Não copiar identidade, contas, banco ou PAT dessa instalação para produção.
- O D1 de produção ainda não foi criado. Foram localizados somente os bancos existentes de QA, preview e experimentos. Não confundir IDs no momento da configuração.
- A recuperação de senha via e-mail está implementada, mas desativada em QA e depende da confirmação da entrega real. A autenticação administrativa com TOTP precisa ser homologada em uma conta dedicada.

## 2. Fase preparatória: código, banco e permissões
1. Validar o resultado de `node --test tests/production-schema.test.cjs`: o arquivo testa as **19 migrações SQL** em um SQLite vazio com integridade referencial e confirma tabelas críticas. Jamais aplicar migrações pela primeira vez num banco que já contenha dados reais.
2. Com autorização para configurar recursos definitivos, criar **D1 novo e vazio**, de nome distinto dos bancos QA, por exemplo `usbrin_id_production`. Anotar o UUID no gerenciador de configurações, sem inseri-lo no código público. Não aplicar nenhuma alteração ao banco QA nesta etapa.
3. Planejar exportação/backup e rollback antes de operações de produção. D1 suporta Time Travel; validar as restrições aplicáveis à conta. Para o banco novo, executar sequencialmente os 19 SQL de `migrations/` em ordem crescente, registrando migrações concluídas e validando a versão/estrutura final. Não misturar aplicação manual por `d1 execute` com `migrations apply` sem ter certeza de como o histórico foi registrado; selecionar um único mecanismo e documentá-lo.
4. Criar identidade de serviço ZITADEL **distinta do QA**, com a permissão mínima de login client. Não usar a conta proprietária, não colocar segredos no GitHub em texto, URL, HTML ou mensagens.
5. Criar um administrador operacional dedicado, com TOTP no provedor, mapeado explicitamente em `users` e `zitadel_identity_links` após validação. Não permitir criação de identidades pela simples candidatura.
6. Configurar widget Turnstile no domínio **`usbrin.com.br`** e validar que o hostname/action do Siteverify correspondem às rotas. Armazenar sitekey como texto público, secret key como Cloudflare Secret. Não usar chaves públicas/de teste no site definitivo.

## 3. Configuração Pages a ser aplicada SOMENTE na janela aprovada

No projeto **`usbrin-site`**, em `Settings → Variables and secrets` e `Bindings`, sob **Production**:

| Configuração | Valor/tipo exigido antes da liberação |
| --- | --- |
| `USBRIN_ID_DB` | D1 de produção **separado**, migrado e vazio de dados QA |
| `fail_open` | `false` para impedir entrega de páginas privadas sem execução de funções |
| `USBRIN_AUTH_MODE` | Texto: `zitadel` |
| `NATIVE_AUTH_HOST` | Texto: `usbrin.com.br` |
| `ZITADEL_API_URL` | Texto: `https://usbrin-id-rzf8mn.us1.zitadel.cloud` |
| `ZITADEL_LOGIN_CLIENT_TOKEN` | **Secret** da conta de serviço definitiva (sem reutilizar QA) |
| `USBRIN_PASSWORD_PEPPER` | **Secret** aleatório, exclusivo da produção |
| `ZITADEL_PASSWORD_RESET_ENABLED` | Texto: `false` até o teste de envio e recuperação do ZITADEL |
| `TURNSTILE_SITE_KEY` | Texto: chave de site autorizada para `usbrin.com.br` |
| `TURNSTILE_SECRET` | **Secret** correspondente à chave acima |
| `APPLICATIONS_ENABLED` | Texto: `false` (NUNCA habilitar no lançamento apenas comercial) |
| `REPRESENTATIVE_APPLICATIONS_HOST` | Texto: `usbrin.com.br` |
| `REPRESENTATIVE_APPLICATIONS_ENABLED` | Texto: `false` até aprovação e testes da campanha |
| `REPRESENTATIVE_STATUS_ENABLED` | Texto: `true` para manter a consulta segura dos protocolos após encerramento |

O pacote Cloudflare Pages e suas rotas devem ser publicados **apenas depois** de preparar tudo acima e confirmar o ambiente de publicação. A mudança de variáveis pode exigir uma nova implantação da branch de produção; não pressupor aplicação imediata. A branch da versão integrada ainda precisa passar por revisão para ser incorporada à branch Git conectada ao domínio.

## 4. Verificação automatizada sem revelar segredos

O arquivo `scripts/production-readiness.cjs` recebe a **resposta JSON de leitura** do projeto Pages pela entrada padrão, sem salvar/mostrar valores de secretos. Exemplo, apenas após autorização de acesso ao endpoint, executado de ambiente confiável:

```bash
curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/usbrin-site" |
  node scripts/production-readiness.cjs
```

Esse comando é **leitura apenas**. Se algum requisito estiver ausente ele sai com erro e enumera somente o nome da verificação pendente. A opção `--campaign` exige que a flag exclusiva de representantes esteja `true` e que as inscrições de desenvolvedores continuem `false`.

**Importante:** passar na verificação de variáveis **não prova** que PAT é válido, D1 tem migrações completas, DNS/SSL funcionam, TOTP é válido, Turnstile aceita um token real, ou que e-mails de recuperação chegam. Essas validações práticas são obrigatórias, manualmente e com contas QA/produção dedicadas.

## 5. Jornada de homologação antes da abertura
- [ ] Backup/rollback e conferência de DNS, SSL, noindex de login e guarda de rotas privadas.
- [ ] URLs `/login`, `/portal`, `/js/portal.js`, `/proposta`, `/api/private/me` negadas sem sessão; `/parceiros`, `/studio`, `/portfolio` preservados.
- [ ] Login com conta aprovada; TOTP administrativo válido e inválido; suspender/revogar; logout real; renovação/expiração de sessão.
- [ ] Turnstile real em mobile e desktop; bloqueio sem token, token duplicado, hostname inválido, origem cruzada e campos inválidos.
- [ ] Inscrição de representante de ponta a ponta, consulta de protocolo e processo de avaliação; nenhuma conta automaticamente habilitada.
- [ ] Encerrar inscrições (`REPRESENTATIVE_APPLICATIONS_ENABLED=false`) e verificar que `REPRESENTATIVE_STATUS_ENABLED=true` mantém o protocolo acessível.
- [ ] Verificar roteamento do formulário e do site em HTTPS, erros e observabilidade, isolamento das oportunidades e comissões por representante.
- [ ] Revisão da privacidade/LGPD: responsáveis e atendimento, prazo de retenção, descarte e documentação do processo seletivo, conforme assessoria adequada.
- [ ] Rotação do PAT de QA criado anteriormente com vencimento informado de **19/12/2026**, sem inserir tokens em documentos ou mensagens.
- [ ] Revisão final dos preços de referência sem alterações: Landing R$690, Business R$1.190, Catálogo R$1.790, serviços e adicionais atuais do Studio.
- [ ] Aprovação expressa da versão do site e depois, em etapa separada, da abertura das inscrições.

## 6. Estratégia de publicação e reversão
1. Publicar versão integrada no projeto e domínio oficiais somente após o gate e autorização; **deixar `REPRESENTATIVE_APPLICATIONS_ENABLED=false`**.
2. Verificar imediatamente home, Studio, portfólio, formulário fechado, bloqueio de rotas privadas, login de conta controlada e eventos de erro. Ter pronto o ID de deployment anterior do Pages para rollback.
3. Após homologação no domínio real, aprovar abertura da campanha e mudar **somente** a flag de representantes para `true` no host exato, seguido de deploy quando necessário. `APPLICATIONS_ENABLED=false` permanece.
4. Se houver incidentes, desabilitar imediatamente `REPRESENTATIVE_APPLICATIONS_ENABLED` e voltar à implantação oficial anterior. Não remover dados de candidaturas nem reverter migrações destrutivamente.
5. Após o fim da janela de inscrições, desligar a flag de cadastro e manter somente a consulta de protocolo com proteção.

**Referências Cloudflare:**
- https://developers.cloudflare.com/pages/functions/routing/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/turnstile/get-started/
