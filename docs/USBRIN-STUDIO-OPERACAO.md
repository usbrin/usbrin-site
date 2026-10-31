# USBRIN Studio — Operação comercial e liberação
Data: 30/10/2026
Status: candidato a lançamento, NÃO validado em produção.
PR: https://github.com/usbrin/usbrin-site/pull/2

## Objetivo e arquitetura
Integração estática (GitHub Pages no repositório atual), sem backend, sem checkout, sem área administrativa privada. O cliente:
1. Escolhe Landing, Business ou Catálogo.
2. Explora quatro demos fictícias, seleciona referência, páginas, cores e estilo.
3. Configura recursos opcionais, vê estimativa instantânea e prévia conceitual (não promessa de resultado final).
4. Preenche nome e objetivo, autoriza preparar texto, revisa e decide abrir WhatsApp ou e-mail.

O sistema **não** formaliza contrato, **não** recebe pagamento e **não** envia mensagens automaticamente.

## Tabela comercial aprovada para fase experimental de cinco contratos
As regras estão centralizadas em `js/studio-pricing.js`, versão `mvp-2026-10-30`.

| Produto | Base | Incluído | Limite |
|---|---:|---|---|
| Landing | R$ 690 | 1 página / até 6 seções padrão | 1 página |
| Business | R$ 1.190 | até 5 páginas padronizadas | até 15 no configurador |
| Catálogo | R$ 1.790 | até 5 páginas padronizadas e até 20 itens | até 15 páginas |
| Página além da franquia | R$ 120 | página padronizada | limites acima |
| WhatsApp | incluso | botão/atalho | |
| Formulário avançado | R$ 150 | campos e validação | |
| Galeria | R$ 180 | exposição de projetos | |
| Blog gerenciável | R$ 450 | conforme escopo combinado | |

Valores **não testados com clientes**, não são dados de mercado ou preços aprovados. A revisão de briefing pode gerar preço superior ou inferior ao estimado, desde que haja explicação comercial e concordância do cliente.

**Nunca precificar automaticamente:** agendamento com integração, e-commerce com checkout, pagamentos, login/área restrita, integrações externas, sistemas sob medida, catálogo acima de 20 itens ou qualquer requisito de segurança/regulamentação mais rigorosa. O motor marca `reviewRequired`, mantém a estimativa apenas do escopo padrão e avisa a exclusão explícita.

As preferências visuais e número de cores são gratuitas na configuração padrão, mas identidade visual completa, licenças e trabalhos especiais não são inclusos automaticamente.

## Checagem de viabilidade antes de aprovar proposta
Para cada oportunidade, registrar:
- Escopo de páginas *reais*, blocos e funcionalidades; distinguir páginas padronizadas de layouts inéditos.
- Quantas horas serão gastas no briefing, design, conteúdo, desenvolvimento, testes, revisões, publicação, suporte inicial e gestão.
- Custos de terceiros, produção de imagens e textos, domínio, infraestrutura, sistema de gestão do blog, hospedagem e taxas.
- Tributos estimados conforme regime tributário da empresa e taxas financeiras.
- Custo econômico do tempo da equipe e custo de oportunidade.
- Margem de contribuição ajustada: (preço - custos variáveis - horas x custo/hora) / preço.
- Meta inicial proposta: 40% ou mais nessa métrica; calibrar com o histórico de entrega, despesas fixas e canal de aquisição.
- Se o orçamento não sustentar o custo, revisar escopo ou preço **antes** de enviar a proposta.

## Processo comercial interno
**Novo contato** → verificar se mensagem foi realmente enviada no WhatsApp/e-mail (abertura de link não é recebimento).
**Qualificação** → setor, objetivo, prazo, materiais fornecidos e funcionalidades.
**Análise** → estimativa de horas/custo, necessidade de tecnologia diferente, eventuais exigências de dados pessoais.
**Proposta** → documento com lista precisa de entregáveis, inclusões/exclusões, condições de revisões, preço, prazo, despesas recorrentes, suporte e validade comercial.
**Contrato** → só após aceite formal, não na calculadora.
**Produção** → entrada de 50% após assinatura e saldo de 50% após aprovação, antes de disponibilização/transferência definitiva, se essa política for aprovada na proposta. Não utilizar a entrada recebida sem provisionar os custos de entrega.
**Pós-venda** → solicitar feedback e oferecer manutenção contratual opcional, sem prometer resultados comerciais garantidos.

## Métricas
É necessário usar uma ferramenta externa **devidamente configurada** para medir o funil entre dispositivos. O frontend emite eventos somente quando `window.dataLayer` já existe, sem nome ou briefing:
- `usbrin_studio_configuration_started`
- `usbrin_studio_proposal_prepared`
- `usbrin_studio_whatsapp_open_clicked`
- `usbrin_studio_email_open_clicked`

Esses eventos **não estão sendo persistidos**, pois o site não tem integração de analytics configurada. Clique para abrir WhatsApp não equivale a lead recebido ou venda. Conciliar manualmente mensagens recebidas com planilha/CRM.

Indicadores recomendados:
- Visitas ao Studio e taxa de início/configuração;
- Pedidos preparados, mensagens efetivamente recebidas e leads qualificados;
- Propostas emitidas / aceitas;
- Ticket, horas reais, margem real e taxa de retrabalho.

## Dados e privacidade
- Escolhas técnicas não pessoais são guardadas em `localStorage` no navegador para retomar o orçamento; é possível limpar clicando em "Recomeçar".
- Nome, empresa, objetivo e observações não são gravados localmente nem enviados ao servidor do site.
- O link de compartilhamento inclui **somente escolhas não pessoais** (tipo, páginas, estilo, funcionalidades, número de cores e referência). Não inclui nome, empresa, objetivo ou observações.
- WhatsApp e e-mail são aplicativos externos: o usuário revisa e confirma o envio por conta própria. Tratar os dados recebidos de forma adequada e providenciar política de privacidade e processo de eliminação conforme operação real antes do lançamento.
- Preços exibidos no JavaScript são visíveis e alteráveis por visitantes; não confiar em valores recebidos do cliente para contratos. Análise interna obrigatória.

## Arquivos
- `studio.html`: apresentação e formulário; atualmente `noindex,nofollow` até aprovação.
- `css/studio.css`: identidade, responsividade, prévia, acessibilidade e impressão.
- `js/studio-pricing.js`: tabela e cálculos (única fonte de verdade).
- `js/studio.js`: UI, resumo, configurações locais, mensagem/links e eventos opcionais.
- `tests/studio-pricing.test.cjs`: testes unitários.
- `tests/studio-browser.cjs`: testes de navegador com Playwright.
- `.github/workflows/studio-validation.yml`: testes de precificação e browser quando disparados pelo GitHub Actions.

## Testes antes de publicação
1. `node --test tests/studio-pricing.test.cjs` (Node 22).
2. `node --check js/studio-pricing.js && node --check js/studio.js`.
3. `CHROMIUM_PATH=/caminho/do/chromium node tests/studio-browser.cjs` após instalar Playwright.
4. `CHROMIUM_PATH=/caminho/do/chromium node tests/browser.cjs` — garantir que o site anterior segue funcionando.
5. Verificar manualmente em desktop e celular real: menus, zoom, fontes, preços, link das demos, link de compartilhamento, navegação ao WhatsApp, copy, exportação, consentimento e texto do resumo.
6. Revisar jurídico/comercial: valores, inclusões, materiais, prazos, manutenção, política de privacidade.
7. Confirmar estratégia de hospedagem. O README original alerta para restrições do GitHub Pages relacionadas a sites voltados principalmente a transações comerciais. Verificar os termos vigentes e migrar quando necessário; não presumir que GitHub Pages é hospedagem comercial definitiva.
8. Só então concluir PR #2, publicar e retirar `noindex` se a indexação for desejada.

## Limitações assumidas e próximas integrações
**Não implementadas:** contas de clientes, CRM persistente, painel administrativo privado, edição remota de preços, geração de propostas contratuais, envio automático de mensagens, analytics efetivo entre dispositivos e cobrança. Essas funções exigem hospedagem/backend apropriado, autenticação e governança; não simular uma área administrativa no JavaScript público.

**Diferencial entregue no MVP:** experiência guiada com quatro demonstrações, prévia visual, estimate híbrido, proteção de projetos complexos, persistência não pessoal no navegador, compartilhamento e envio revisado.
