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

## Homologação de acesso público e privado — novembro de 2026

### Separação validada por teste externo
- Foi gerada uma superfície pública isolada em **`/public/*`**, por allowlist no `scripts/build-static.cjs`: páginas de recrutamento/candidatura/consulta, privacidade e apenas CSS, JS e imagens necessários. O pacote não copia `portal.html` nem `js/portal.js` para o diretório público.
- As APIs públicas em `/public/api/public-config`, `/public/api/applications` e `/public/api/application-status` reutilizam os handlers validados em `functions/api` e permanecem protegidas por Turnstile e feature flag.
- O Cloudflare Access criou uma **aplicação específica de homologação para `feature-usbrin-partners-plat.usbrin-site.pages.dev/public/*`** com política Bypass Everyone. É uma exceção *apenas para páginas públicas de recrutamento* no alias de preview. A política preexistente `*.usbrin-site.pages.dev` segue protegendo o restante.
- A exceção Bypass foi usada estritamente para navegação pública; ela desativa os controles Access para essas rotas, conforme alerta da documentação. Nunca adicionar arquivos privados à allowlist `dist/public`.
- O GitHub Actions `.github/workflows/preview-access-smoke.yml` verificou por HTTP externo: páginas públicas retornam 200, API pública informa inscrições fechadas, POST de candidatura fechada retorna 503, `/portal.html` e `/api/private/me` redirecionam visitantes sem login (HTTP 302).
- Links para a nova área pública em homologação: `https://feature-usbrin-partners-plat.usbrin-site.pages.dev/public/parceiros.html`.

### Integridade de pagamentos
- Migração `0007_atomic_receipts.sql` aplicada **somente ao D1 de preview**.
- Inserir um recibo ativa um trigger SQL que verifica o saldo e atualiza a venda e a oportunidade no mesmo comando. Tentativas acima do valor contratado são rejeitadas mesmo com leituras concorrentes e recibos já registrados não podem ser atualizados ou apagados.
- O backend não altera manualmente o total recebido fora do trigger. Referências financeiras permanecem obrigatórias.
- Testes de integração verificam soma dos recibos = total recebido, rejeição de estorno por alteração do histórico e proibição de recebimentos excedentes.

### Experiência do recrutamento
- No portal privado, a administração dispõe de filtros por modalidade/status, busca por nome/e-mail/protocolo e dossiê detalhado de cada candidatura (experiência, motivação e portfólio).
- As observações internas podem ser salvas separadamente do avanço de etapa, pelo endpoint protegido `admin/application-note`.
- Mudanças de status exigem a sequência de seleção prevista; ativação de conta exige contrato referenciado. A mudança de etapa **não envia notificação automática** ao interessado.

### Limites e pendências para produção
1. Configurar aplicativo Access para **usuários reais convidados** (representantes e desenvolvedores), mantendo validação JWT e papel em D1; a política atual do preview autoriza apenas a identidade administrativa e ainda não é login público para todos os parceiros.
2. Validar em navegador o visual das páginas públicas, acessibilidade e o fluxo completo de inscrição com Turnstile, sem coletar dados antes da revisão jurídica.
3. Definir bases legais, prazos de retenção e comunicação de candidaturas; revisar contratos brasileiros de colaboração e comissões.
4. Criar D1 de produção separado e configurar política Access por caminhos na produção antes de publicar o portal; não alterar a branch de produção até homologação final.

## Segurança operacional — suspensão e reativação de parceiros (07/11/2026)

- A aba **Parceiros** do portal administrativo lista contas de representantes e desenvolvedores, com papel, e-mail, situação e indicador de contrato previamente verificado.
- O administrador pode **suspender** a conta de um parceiro ativo, mediante justificativa de pelo menos oito caracteres. A mudança é auditada no D1; o backend consulta o estado do usuário a cada requisição e recusa operações se não estiver `active`, mesmo quando existe JWT Access válido.
- O administrador não pode suspender contas de administração nessa tela e os parceiros não podem administrar acessos. A reativação é permitida apenas a parceiro suspenso com referência contratual e data de verificação já registradas. Antes da reativação, conferir manualmente a vigência real do contrato, identidade e pendências do relacionamento.
- **Limitação essencial:** suspender no D1 bloqueia o uso das APIs da USBRIN, mas não exclui automaticamente a identidade da política Cloudflare Access. Para encerramento definitivo da parceria, também revogar o acesso na política da Cloudflare e documentar o procedimento.
- Testes automatizados usam contas fictícias e JWTs RSA assinados apenas em memória para confirmar: usuário ativo acessa rota de seu papel, suspenso recebe HTTP 403, usuários de outros papéis não administram, admin não suspende admin, e reativação exige contrato previamente verificado.
- Não criar contas reais ou ampliar a lista de e-mails da aplicação Access de homologação sem necessidade operacional e avaliação dos controles de identidade.

### Homologação manual ainda necessária
1. Criar dois parceiros fictícios **somente quando as identidades de teste estiverem sob controle** e a política de acesso estiver configurada para eles, sem abrir a autenticação para todos indiscriminadamente.
2. Conferir painel e isolamento por papéis em navegador real e no celular; dados de representante A não devem aparecer para representante B ou desenvolvedor.
3. Suspender cada conta e verificar que solicitações ao backend passam a retornar 403; remover identidades da política Access quando houver encerramento permanente.
4. Verificar manualmente os avisos de privacidade, a base legal e o período de retenção antes da abertura pública de candidaturas reais.
5. Manter o PR como rascunho e a produção intacta até liberação expressa.

## Homologação de login por e-mail OTP — 07/11/2026

- Identidades de teste: `usbrin.redes+teste-representante@gmail.com` (representante), `usbrin.redes+teste-desenvolvedor@gmail.com` (desenvolvedor). São aliases da caixa administrada pela USBRIN, **exclusivamente para testes**; não representam profissionais contratados.
- Contas criadas **somente no D1 Preview** com `status='active'`, `contract_reference=NULL` e `contract_verified_at=NULL`. O indicador de contrato do painel aparecerá como **Não**; é intencional. Esse tipo de conta não pode ser reativado pela interface sem verificação de contrato. **Nunca migrar esses registros para produção.**
- Política Access adicional `USBRIN Homologacao - Perfis Teste`, `allow`, precedência 2, inclui **somente** os dois aliases de teste e mantém a política administrativa existente; login por One-time PIN, sem adicionar provedores externos.
- Processo manual: abrir `/portal.html` em sessão isolada; inserir alias de representante; inserir o código recebido na caixa de e-mail principal; verificar que identidade/menus mostram representante. Repetir com alias de desenvolvedor em outro perfil ou janela privativa, sem cookies compartilhados; verificar dashboard individual e recusa de endpoints administrativos.
- Confirmar separação de clientes: criar oportunidade fictícia pela conta representante, confirmar que desenvolvedor não consegue vê-la; criar projeto fictício pelo admin atribuído ao desenvolvedor, confirmar que representante não consegue visualizar projeto privado. **Não usar dados reais nem registrar pagamentos fictícios sem marcação explícita.**
- Testar suspensão no Admin e conferir erro HTTP 403 com JWT ainda válido. Lembrar: a suspensão no D1 não elimina a identidade da lista Access; retirar alias do Access quando não for mais necessário.
- Descarte obrigatório após homologação: excluir a política adicional Access e os dois registros fictícios no D1 Preview **somente depois** de excluir registros de teste que os referenciem, preservando integridade e logs. Não remover conta administrativa nem política Access principal. Alternativamente, manter suspensos temporariamente e nunca habilitar candidaturas/vendas reais na homologação.
- A autenticação **real de ponta a ponta** ainda depende do operador concluir os logins One-time PIN e registrar evidência; confirmação da API de configuração e dos registros D1 não equivale a login validado no navegador.

## Auditoria adicional de papéis e responsividade — 07/11/2026

- **Permissões:** ampliado o teste automatizado para a matriz admin / representante 1 / representante 2 / desenvolvedor 1 / desenvolvedor 2. Cenários negativos: acesso a endpoints administrativos, leitura de leads de outro representante, visualização e modificação de projeto de outro desenvolvedor, criação de projeto por representante e tentativas de POST sem `Origin` ou com `Origin` externo. Testes com JWTs RSA de teste e D1 em memória, **sem criar dados reais**.
- **Regressões:** testes anteriores que pressupunham listas vazias agora validam a propriedade de cada registro, permitindo mais de uma fixture simultânea, sem perder o isolamento.
- **Segurança no Admin:** antes de suspender uma conta de homologação sem contrato verificado, a interface mostra um alerta explícito: ela não poderá ser reativada pela tela normal. As contas reais exigem contrato conferido; a suspensão de teste não foi executada no D1 real nesta etapa.
- **UI real em Chromium:** implementada `tests/responsive-ui.smoke.mjs` e workflow `.github/workflows/preview-responsive-ui.yml`, que verificam três perfis em telas de **375 px, 768 px e 1440 px**, além das telas públicas de recrutamento e candidatura desativada, usando respostas de API simuladas. A navegação, os estados vazios, os papéis visíveis e erros JS são verificados; as capturas ficam por sete dias no artifact de GitHub Actions.
- **Problema identificado e corrigido:** em 375 px a grade do Admin gerava largura horizontal de aproximadamente 900 px. Corrigimos o CSS com trilha `minmax(0,1fr)`, limites `max-width:100%` e scroll horizontal apenas na tabela interna. A suíte Chromium voltou a passar: <https://github.com/usbrin/usbrin-site/actions/runs/42430818888>.
- **Limites da evidência:** browser automatizado usa HTML/CSS/JS reais de `dist/`, mas APIs de mock. Já houve confirmação humana de login OTP real nos três perfis na conversa; ainda falta teste manual da suspensão efetiva de uma sessão ativa e validação da interface no aparelho de destino. Não confundir smoke responsivo com auditoria completa de acessibilidade.
- **Critério de publicação permanece:** nenhum merge ou abertura real de candidaturas antes de revisão jurídica/privacidade, provisionamento de D1 de produção independente, plano de acesso permanente e controle de backups.

## CRM e propostas comerciais — 07/11/2026

### Funcionalidades entregues somente em homologação
- `0008_crm_followups.sql`: adiciona próxima ação, data de contato, último contato, motivo de perda e a tabela `crm_activities`, com histórico vinculado a autor e oportunidade.
- A área **Oportunidades** permite cadastro já com próximo contato, pesquisa, filtro de etapa, filtro de retornos vencidos, registro de contatos e notas internas, reagendamento e consulta do histórico. O Admin vê apenas as informações segundo seu papel; o representante vê apenas suas oportunidades.
- `crm/history` é GET privado; `crm/activity` e `crm/followup` são POST privados com proteção JWT, autorização por papel e origem, e vínculo com o responsável. Nenhuma dessas ações cria venda ou movimenta dinheiro.
- Marcar uma oportunidade como **perdida** exige justificativa e remove o próximo acompanhamento. A administração vê o total de retornos vencidos no painel de prioridades.
- `0009_proposal_drafts.sql`: prepara propostas com escopo, produto, preço em centavos, prazo, validade e condições, vinculadas à oportunidade e ao autor.
- Representantes podem **criar rascunhos** apenas para seus leads. Só o administrador pode revisar e aprovar, informando os quatro grupos de custos estimados: produção, comissão, tributos e outros. Custos maiores que o preço bloqueiam a aprovação; oportunidade encerrada também bloqueia.
- Os custos internos e a margem calculada **não são expostos no retorno da API para representantes**. Propostas aprovadas podem ser abertas em `/proposta.html` e salvas como PDF via impressão do navegador; a página depende de autenticação Access e acesso do usuário à oportunidade.
- A marcação de proposta como enviada exige confirmação explícita de envio por canal externo. **Não há envio automático por e-mail, aceite eletrônico, geração automática de contrato ou venda**. O preço e o prazo ainda exigem revisão humana antes da aprovação.
- Uma proposta rejeitada fica no histórico; para revisões é necessário criar novo rascunho. Não confundir `approved` ou `sent` com contratação efetiva e receita realizada.

### Homologação e limites
- Migrações `0008` e `0009` foram aplicadas à base **Preview** apenas; a produção permanece no branch anterior, e as inscrições continuam desativadas.
- Testes D1 em memória validam papéis, histórico privado, datas de retorno, motivo da perda, aprovação administrativa, custos inacessíveis ao representante, bloqueio de custos acima do preço, bloqueio de oportunidades encerradas, emissão sem venda e marcação manual de envio.
- Chromium valida página de proposta aprovada em telas de 375, 768 e 1440 px, além da geração de um arquivo PDF A4 não vazio. Teste: <https://github.com/usbrin/usbrin-site/actions/runs/42433220284>.
- A análise de margem é estimativa: ainda faltam regras comerciais definitivas para impostos efetivos, custos fixos, despesas de aquisição, provisões de garantia e capital de giro. **Não substituir a decisão financeira do gestor por aprovação automática.**
- Não abrir candidatura pública nem realizar merge antes de revisão jurídica da privacidade e contratos, controle de backup de produção e teste manual de experiência no dispositivo real.

## Guia comercial para representantes — 07/11/2026

- A seção **Guia comercial** está disponível apenas na navegação do administrador e do representante. Não faz parte da área pública nem da visão do desenvolvedor. Há um atalho na área **Oportunidades**.
- Referências alinhadas ao USBRIN Studio atual: Landing **a partir de R$690** (1 página, até 6 seções); Business **a partir de R$1.190** (site institucional, até 5 páginas); Catálogo **a partir de R$1.790** (vitrine de até 20 itens, sem carrinho/checkout/pagamento online). A palavra **a partir de** é obrigatória; escopos adicionais exigem aprovação.
- O checklist de 5 itens orienta a conversa: identificar o objetivo, explicar limites, avisar que preços são iniciais, levantar materiais e funcionalidades, registrar oportunidade/retorno/briefing. Os checks são apenas temporários na tela e **não geram certificação ou aprovação comercial**; a proposta segue submetida à análise do Admin.
- Limites comerciais: nenhum representante deve garantir resultados em vendas ou busca, prazo, desconto, domínio/hospedagem incluídos, suporte recorrente ou integrações além do escopo sem confirmação documental da USBRIN.
- Controle de manutenção: ao atualizar os valores ou escopo oficiais do Studio, atualizar o guia na mesma revisão. No estado atual não há sincronização automática das tabelas de preço.
- Testes Chromium incluem preços e visibilidade nos três perfis e telas de 375/768/1440 px.
