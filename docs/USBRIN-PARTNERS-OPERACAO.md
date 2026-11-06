# USBRIN Partners · Guia de implantação e homologação

## Estado da entrega
- Branch isolada: `feature/usbrin-partners-platform`, baseada em `feature/usbrin-studio-mvp`.
- O site de produção existente não foi substituído.
- Cloudflare Pages constrói `dist` com `npm run build`; rotas da API utilizam Pages Functions.
- Banco D1 de homologação: `usbrin_partners_preview`, exclusivamente associado ao ambiente **preview** pelo binding `DB`. Não contém clientes ou candidaturas reais.
- Migrações SQL `migrations/0001_partners.sql`, `0002_financial_integrity.sql` e `0003_partner_contracts.sql` aplicadas sequencialmente apenas ao D1 de homologação.
- `APPLICATIONS_ENABLED=false` em preview. Nenhuma candidatura ou consulta externa é aceita até liberação explícita, conclusão da privacidade e antifraude.
- Cloudflare Access **não está habilitado na conta**: áreas administrativas e privadas deverão negar acesso até a configuração legítima. A configuração inicial exige ação do proprietário no Cloudflare Dashboard, com escolha de um plano e cadastro de dados de pagamento mesmo no Free (segundo a documentação atual).

## Entregas no código
1. `parceiros.html`: programa comercial e desenvolvedores.
2. `candidatura.html`, `js/candidatura.js`: formulário validado, antispam Turnstile, recibo com protocolo; `status-candidatura.html` e `api/application-status`: consulta protegida por protocolo, e-mail e Turnstile, mostrando apenas o andamento.
3. `portal.html`, `js/portal.js`: interfaces de administração, representante e desenvolvedor.
4. `functions/api/applications.js`: recebimento de inscrições, D1, validação de origem, verificação Turnstile e bloqueio se faltar configuração.
5. `functions/api/private/[[path]].js`: consulta, revisão e ativação de candidatos; leads por proprietário; metas, vendas e comissões; projetos e remuneração técnica; trilha de auditoria.
6. `functions/_lib/auth.js`: validação criptográfica do JWT Cloudflare Access (RS256, emissor, público/audiência, prazo) e função derivada **somente** do usuário aprovado em D1.
7. `migrations/0001_partners.sql`: tabelas separadas, chaves estrangeiras, índices.
8. `privacidade-parceiros.html`: **texto preliminar**, não liberado juridicamente.
9. Testes automáticos via `.github/workflows/partners-validation.yml`.

## Antes de permitir candidatos reais
1. Revisar o aviso de privacidade, prazo de retenção, processo seletivo e contratos com orientação jurídica.
2. Criar/configurar um widget Cloudflare Turnstile para o domínio de prévia (ou homologação dedicado). No **preview** configurar:
   - `TURNSTILE_SITE_KEY`: site key pública;
   - `TURNSTILE_SECRET`: secret_text, **nunca expor no GitHub**;
   - `APPLICATIONS_ENABLED`: iniciar com `false`, alterar para `true` somente após testar.
3. Aplicar a migração versionada no banco específico de produção antes do primeiro lançamento. **Nunca reutilizar o D1 de preview em produção.**
4. Definir consentimentos ou outras bases legais adequadas; não usar informações de candidatos para finalidades não informadas.
5. Testar um cadastro real controlado na homologação, conferir existência no D1, protocolo e tratamento de duplicidade.

## Antes de habilitar o portal restrito
1. Habilitar Cloudflare Access na conta, verificar requisitos e custos, e criar uma **aplicação Access** protegendo `/portal.html` e **toda a rota** `/api/private/*`; verificar também todos os endereços de preview/produção que possam servir essas rotas.
2. Criar políticas para identidades aprovadas; ativar MFA para contas administrativas.
3. Configurar no Pages Preview (não no código) `ACCESS_TEAM_DOMAIN` no formato `https://seu-time.cloudflareaccess.com` e `ACCESS_AUD` com o AUD exato da aplicação criada.
4. Criar o administrador inicial em D1 **somente após identificar e verificar a conta autorizada**. Exemplo SQL com valores substituídos:
   `INSERT INTO users(id,email,name,role,status) VALUES ('UUID_GERADO','email_admin_verificado','Administrador USBRIN','admin','active');`
5. Conferir falhas de acesso sem login, com JWT inválido, com usuário desativado, entre representantes distintos e entre desenvolvedores.
6. Confirmar a política contratual de remuneração, direitos de cancelamento e critérios de exigibilidade antes de pagar comissões.

## Ressalvas e limites do MVP
- O backend possui endpoints e telas para administração, mas **não** representa folha de pagamento, ERP ou software contábil certificado.
- O fluxo exige registrar cada parcela recebida com referência única e os pagamentos com referência bancária; não permite registrar comissão de venda ainda não integralmente recebida. Não automatiza conciliação bancária.
- O portal do desenvolvedor permite consultar obrigações registradas para sua conta, não dados de outros parceiros.
- O processo seletivo exige passar por análise, pré-aprovação e documentação antes da aprovação final; ativação exige referência de contrato já assinado.
- Não há processamento bancário automático, assinatura eletrônica, e-mail transacional ou ativação automática de usuários.
- Registro de venda e pagamento depende de conciliação pela administração.
- A experiência de candidatura está fechada por padrão para impedir coleta prematura de dados.
- O painel não foi testado com usuários reais, pois o Access não está habilitado.
- Faltam testes completos ponta a ponta com identidades reais; sem isso, não deve ser publicado como sistema pronto.
- Há controles de unicidade e verificações de concorrência, mas a integridade financeira e a conciliação precisam de testes adicionais sob carga antes de operar com grande volume. Métodos de pagamento, impostos e custos ainda não formam um ERP completo.
- A capacidade de entrega da USBRIN e a revisão das condições comerciais permanecem decisões empresariais, não automações.

## Verificação
- Rodar `npm run build`.
- Rodar `node --test tests/studio-pricing.test.cjs`.
- Validar `node --check` em cada JavaScript novo.
- Rodar migrações em SQLite temporário.
- Conferir a execução de `USBRIN Partners — Validation` em Actions.
- Inspecionar UX em desktop e celular, caminhos do Studio e Store antes de merge.
- Confirmar que `/api/public-config` retorna `applicationsOpen:false` até ativação e que endpoints privados retornam erro de autorização sem Access.
- Não mesclar ou alterar a branch de produção até aprovação expressa da administração, testes e revisão jurídica.

## Operação sugerida
Abrir primeiro candidaturas controladas; selecionar até três representantes e um ou dois desenvolvedores; revisar a conversão, a margem de cada plano, a qualidade das entregas e o suporte antes de ampliar a rede.

## Novos requisitos de qualidade
- A implantação inclui fluxo de recibos com referências de transação e três migrações SQL versionadas. Aplicar na ordem, em banco exclusivo da produção quando houver autorização.
- Nenhum usuário administrador deve ser cadastrado com senha hardcoded. A identidade deve ser estabelecida pelo serviço de login, associada ao e-mail previamente verificado e à linha aprovada em D1.
- Os testes de integração usam banco SQLite temporário e chaves RSA geradas para teste; não são clientes ou parceiros reais.
- A URL de homologação não deve receber inscrições reais até o Turnstile, aviso de privacidade e fluxo administrativo serem concluídos.
- O saldo de venda, referências de pagamento e margens não substituem contabilidade e conciliação financeira. Recomenda-se um contador para regras tributárias e advogado para enquadramento dos parceiros.
- Se o Cloudflare Access não puder ser habilitado, não substituir por um login fake, senha localStorage ou endpoint sem assinatura.

## Ações do proprietário para desbloquear a homologação
1. Abra https://dash.cloudflare.com/ e entre na conta da USBRIN.
2. Acesse Zero Trust; conclua o cadastro da organização, escolha o plano Free (se disponível para a conta), revise limites e providencie dados de cobrança exigidos pela Cloudflare.
3. Confirme o domínio de equipe gerado em Zero Trust > Settings.
4. Configure uma aplicação Access para a prévia, autorizando apenas identidades aprovadas, protegendo as rotas do portal e das APIs. Exija MFA para administrador.
5. Registre a referência da aplicação Access e as credenciais de configuração no painel da Cloudflare, nunca no repositório.
6. Crie uma chave Turnstile para o domínio de prévia e configure site key e segredo, mantendo inscrições fechadas até passar nos testes.
7. Só após verificações e aprovação de privacidade/contratos abra candidaturas; configuração de produção requer banco D1 diferente do ambiente de teste.


## Acesso de homologação confirmado em 05/11/2026
- A organização Zero Trust foi criada e foi identificada na conta como `dry-waterfall-325e.cloudflareaccess.com`.
- O Pages Preview Access foi ativado para `*.usbrin-site.pages.dev`, limitado à identidade Cloudflare administradora verificada da USBRIN. O domínio principal de produção `usbrin-site.pages.dev` não foi bloqueado.
- As configurações `ACCESS_TEAM_DOMAIN` e `ACCESS_AUD` foram adicionadas ao ambiente Preview do Pages. A configuração deve ser validada em uma implantação posterior à alteração.
- A conta administrativa foi provisionada **somente no banco de homologação** com o e-mail verificado de proprietário da Cloudflare. Não há senha hardcoded.
- `APPLICATIONS_ENABLED=false` permanece obrigatório. Turnstile de homologação já foi criado via Cloudflare API, com segredos armazenados exclusivamente como `secret_text` no ambiente Preview. Candidatos ainda não podem se inscrever.
- Não há aplicação privada publicada em produção; tudo deve continuar na branch `feature/usbrin-partners-platform` até testes manuais de login e revisão de segurança.

## Widget Turnstile de homologação (06/11/2026)
- Foi criado **USBRIN Partners - Homologacao**, modo `managed`, autorizado para o hostname `feature-usbrin-partners-plat.usbrin-site.pages.dev`.
- Chave pública em `TURNSTILE_SITE_KEY` e chave privada em `TURNSTILE_SECRET` como variável secreta do Cloudflare Pages, **somente Preview**.
- A chave secreta não foi gravada no GitHub nem no relatório. Nunca copiá-la para arquivos públicos ou mensagens.
- `APPLICATIONS_ENABLED=false` permanece até aprovação de privacidade/contratos e teste manual do envio completo. O widget não torna as inscrições públicas automaticamente.
- Para produção, criar um widget com hostname de produção e secret separado; nunca usar o mesmo banco de homologação para candidatos reais.

## Evolução operacional — Studio → CRM → Produção (06/11/2026)

### Funcionalidades entregues em homologação
- **Central de prioridades** em `portal.html` para administradores: candidaturas, novos briefings Studio, projetos atrasados, vendas em aberto e oportunidades sem atualização há mais de 7 dias. Contagens usam consultas reais ao D1.
- O formulário de **metas mensais** aparece apenas quando houver representantes ativos cadastrados.
- Nova opção de **envio direto no USBRIN Studio**, sem remover o WhatsApp/e-mail: coleta nome, empresa opcional, contato, objetivo e briefing apenas após confirmação específica e Turnstile; não existe armazenamento automático durante a configuração.
- **Fila administrativa do Studio** com busca por nome/empresa/protocolo, revisão, observações internas, filtragem e atribuição a um representante aprovado.
- **Uma solicitação só pode originar uma oportunidade** de CRM; unicidade assegurada por tabela vinculada em transação.
- **Uma venda recebida pode originar um projeto técnico**; um índice único impede projeto duplicado para o mesmo contrato. Projetos avulsos continuam permitidos.
- A remuneração técnica da produção exige aprovação e não pode ultrapassar, sozinha, o valor bruto da venda vinculada. Isso não é cálculo completo de margem.

### Dados e flags
- Migrações novas e aplicadas somente em D1 de homologação: `0004_studio_inquiries.sql`, `0005_studio_assignments.sql`, `0006_sale_project_links.sql`.
- Variável **`STUDIO_INQUIRIES_ENABLED`** é opt-in e, se ausente ou diferente de `true`, bloqueia recebimento de qualquer dado pelo endpoint `/api/studio-inquiry`. A configuração atual continua **desativada**.
- A API exige `TURNSTILE_SECRET`, token válido com ação `usbrin_studio`, origem HTTPS correspondente e confirmação de privacidade, além de chave idempotente por envio.
- O valor do orçamento é registrado como **estimativa informada pelo navegador**; não constitui preço validado, contrato aceito ou valor recebido. Revisão de preço e tributação continua humana.
- `privacidade-studio.html` é um aviso preliminar e requer revisão, inclusive política de retenção, antes de coletar dados reais.
- Na produção, separar **recrutamento/Studio públicos** de **portal e API privados protegidos pelo Cloudflare Access**. O Pages Preview está hoje integralmente protegido por Access; isso é correto para homologação, mas não deve ser usado como canal público de candidatura.

### Testes e critérios de liberação
1. CI: sintaxe, scripts do Studio, todas as seis migrações, prevenção de candidaturas duplicadas, Turnstile mock, controle de acesso, recibos, comissões, envio consentido do Studio, atribuição única a representante e vínculo único venda→projeto.
2. Testar manualmente os fluxos em navegador autenticado: alternância entre telas, formulário de metas sem representantes e navegação em celular.
3. Para testar o Studio direto com servidor e widget reais, habilitar o flag **somente em homologação** depois de confirmar texto de privacidade, realizar cadastro de teste autorizado e verificar apagamento dos dados de teste.
4. Concluir desenho da política Access **por caminho** antes de publicar formulários públicos; nunca liberar `/api/private/*` sem política e sem verificação de identidade e papel no servidor.
5. Migrações e segredos **separados** em produção, testes negativos de autenticação e permissões antes do merge.
6. Definir etapas jurídicas, critérios de comissão e retenção antes do lançamento nacional.

O site oficial `usbrin-site.pages.dev` permanece com a versão anterior, sem publicação dessas alterações. A branch e o Pull Request devem continuar de homologação até aprovação final.
