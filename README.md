# USBRIN — Site oficial

Site estático em HTML, CSS e JavaScript, sem banco de dados; utiliza build de cópia/ajuste de URLs para publicar em Cloudflare Pages. Repositório original: https://github.com/usbrin/usbrin-site

## Execução local

```sh
python3 -m http.server 8000
```

Abra http://localhost:8000. O servidor não é necessário em produção; publique apenas os arquivos do site, sem `.git`, testes ou documentação.

## Estrutura

- `index.html`: apresentação, destaque de quatro projetos autorais, soluções, processo, FAQ, formulário e acesso ao Studio e Portfolio.
- `studio.html`: configurador híbrido e prévia conceitual, com valores preliminares (noindex enquanto não aprovado).
- `css/studio.css`: estilo do Studio, responsivo.
- `js/studio.js` e `js/studio-pricing.js`: interação, regras comerciais e geração do resumo.
- `css/style.css`: identidade e responsividade.
- `js/main.js`: navegação, carrossel e interações visuais.
- `js/quote.js`: validação, prévia e composição do link WhatsApp.
- `portfolio.html`: catálogo autoral com busca, filtros por setor e vinte e dois projetos navegáveis na branch de preview.
- `demo-*.html`: vinte e duas experiências conceituais: quatro demonstrações reformuladas e dezoito projetos novos, incluindo Pilar Engenharia e Nimbo Móveis.
- `js/demo-portfolio.js`: filtro de obras/imóveis, galeria, diálogo de detalhes e experiências demonstrativas; não envia, salva ou processa transações.
- `js/portfolio-engine.js`: motor puro de cálculos e dados de produto, testável em Node.js e executado no navegador.
- `js/portfolio-suite.js`: regras ilustrativas puras para cenários B2B e fluxos simulados, sem rede.
- `js/portfolio-commerce.js`: regras puras de catálogo, busca, opções de produto, carrinho e entrega fictícia.
- `js/portfolio-retail.js`: regras puras de looks, medidas ilustrativas, cálculo de materiais e lista de referência.
- `js/portfolio-atelier.js`: catálogo, curadoria de presentes, comparador e rotina cosmética não clínica.
- `js/portfolio-experiences.js`: motor puro para simulação de estadia e composição de serviços automotivos.
- `js/portfolio-specialists.js`: regras de briefing de móveis planejados e contato institucional odontológico.
- `demo-vereda-planejados.html`: ambientes editoriais e configurador sem orçamento automático.
- `demo-sorriso-claro.html`: especialidades e preparação de contato não clínico, sem dados pessoais.
- `js/demo-specialists.js` e `css/demo-specialists.css`: duas interfaces independentes, responsivas e sem checkout.
- `demo-vista-hotel.html`: experiência editorial de hotelaria com comparação de suítes e planejamento de diárias hipotéticas.
- `demo-motor-forma.html`: estética automotiva com pacotes, opções por porte de veículo e total ilustrativo.
- `js/demo-experiences.js` e `css/demo-experiences.css`: interações e duas identidades responsivas sem checkout ou reservas.
- `demo-aurea-joias.html`: joalheria premium conceitual com seleção de presentes, busca e comparação.
- `demo-essencia-cosmeticos.html`: cosméticos conceituais com catálogo e Routine Studio de textura e etapas.
- `js/demo-atelier-market.js` e `css/demo-atelier.css`: interações e estilos editoriais separados por marca.
- `demo-lume-moda.html`: e-commerce editorial de moda com fotografia, Look Studio e guia de medidas.
- `demo-base-norte.html`: catálogo de materiais de construção, cálculo didático de quantidades e lista local.
- `js/demo-retail.js` e `css/demo-retail.css`: interações e estilos responsivos dessas novas experiências.
- `demo-volta-tech.html`: vitrine fotográfica de eletrônicos, filtros, opções e sacola demonstrativa.
- `demo-casa-patta.html`: vitrine de pet shop, fotos de ambientação, categorias e sacola demonstrativa.
- `js/demo-commerce.js` e `css/demo-commerce.css`: interação e apresentação das lojas, sem checkout, API ou dados pessoais.
- `demo-norte-contabil.html`: experiência corporativa com cenários financeiros didáticos, sem apuração fiscal.
- `demo-nexo-automacao.html`: experiência tecnológica no padrão visual USBRIN, com simulação local de automações.
- `demo-pilar.html`: portfólio técnico de estudos, etapas e laboratório didático de estimativas.
- `demo-nimbo.html`: catálogo de mobiliário com busca, filtros, configuração e comparação ilustrativa.
- `docs/USBRIN-PORTFOLIO-PLANO.md`: mapa de 50 projetos previstos e critérios de qualidade.
- `assets/`: logos originais, prévias e artes SVG autorais; as duas novas lojas usam imagens de ambientação Unsplash via CDN externa.
- `sitemap.xml`: rotas geradas pelo build, incluindo Portfolio; demonstrações conceituais usam `noindex`.

## Contato e orçamento

WhatsApp: https://wa.me/5569992967459. E-mail: usbrin.contato@gmail.com.

O formulário exige nome, tipo e objetivo. Empresa, funcionalidades e detalhes são opcionais. Os dados ficam somente na página até o visitante abrir o WhatsApp. A prévia usa `textContent` e o texto do link usa `encodeURIComponent`; não existe envio automático, armazenamento, backend ou rastreamento adicionado. Ao editar um campo, a prévia anterior é invalidada. Sem JavaScript, os contatos diretos e FAQ continuam disponíveis.

O parâmetro `?demo=restaurante`, `construtora`, `clinica` ou `imobiliaria` acrescenta uma referência conhecida ao pedido. Outros valores são ignorados. A página inicial não publica preços. O Studio exibe preços-base **aprovados para um piloto de cinco contratos**, não vinculantes e sujeitos ao briefing e proposta definitiva. Os valores fictícios de pratos e imóveis permanecem nas demonstrações. Consulte `docs/USBRIN-STUDIO-OPERACAO.md`.

## Recuperação

Versão original: commit `63e47c868b6cd3b92fc8f25ecf9be61d4b57b550`, preservado na branch `backup/pre-optimization-2026-10-29`. Para desfazer a atualização, reverta o commit de integração por um novo commit, sem reescrever o histórico.

## Hospedagem

O GitHub Pages contém restrições para operar negócios e sites destinados principalmente a facilitar transações comerciais: https://docs.github.com/pt/pages/getting-started-with-github-pages/github-pages-limits . Antes de ampliar a operação comercial, confirme o enquadramento com o GitHub ou escolha uma hospedagem adequada. Não há checkout ou processamento de pagamento neste site.

**Hospedagem atual:** Cloudflare Pages Free, projeto `usbrin-site`, conectado ao GitHub. O build é `npm run build`, saída `dist`, com `CF_PAGES_URL` usado para atualizar o canonical e sitemap. A branch de produção continua `feature/usbrin-studio-mvp`; a evolução do portfólio foi desenvolvida separadamente na branch `feature/usbrin-portfolio-20261110`, via PR #5 em rascunho, sem merge ou alteração de produção. Consulte `docs/CLOUDFLARE-PUBLICACAO.md`. Não há checkout, cobrança ou backend nas demonstrações. Os arquivos `vercel.json` e `docs/VERCEL-PUBLICACAO.md` são referências anteriores.

## Testes

Instale Playwright no ambiente de desenvolvimento e disponibilize Chromium. Execute `CHROMIUM_PATH=/caminho/do/chromium node tests/browser.cjs`. O teste cria seu próprio servidor local na porta 8001 e não envia mensagens. Consulte `docs/VALIDACAO-2026-10-29.md` para resultados e limites.

Para o Studio: execute `npm run test:pricing` e, com Playwright/Chromium, `CHROMIUM_PATH=/caminho/do/chromium node tests/studio-browser.cjs`.

Para o Portfolio: execute `npm run test:portfolio`, `node --test tests/portfolio-pro.test.cjs`, `node --test tests/portfolio-suite.test.cjs`, `node --test tests/portfolio-commerce.test.cjs`, `node --test tests/portfolio-retail.test.cjs`, `node --test tests/portfolio-atelier.test.cjs`, `node --test tests/portfolio-experiences.test.cjs`, `node --test tests/portfolio-specialists.test.cjs` e `CHROMIUM_PATH=/caminho/do/chromium node tests/portfolio-browser.cjs`. O workflow `USBRIN Portfolio — validação` confere a integridade, as interações e a responsividade (360, 390, 768 e 1366 px), além da regressão do Studio. Ele produz capturas de tela para revisão visual. A documentação de operação e pré-lançamento está em `docs/USBRIN-STUDIO-OPERACAO.md`.
