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
- `portfolio.html`: catálogo autoral com busca, filtros por setor e oito projetos navegáveis na branch de preview.
- `demo-*.html`: oito experiências conceituais, incluindo quatro demonstrações originais reformuladas e quatro projetos criados para a coleção.
- `js/demo-portfolio.js`: filtro de obras/imóveis, galeria, diálogo de detalhes e experiências demonstrativas; não envia, salva ou processa transações.
- `docs/USBRIN-PORTFOLIO-PLANO.md`: mapa de 50 projetos previstos e critérios de qualidade.
- `assets/`: logos originais, prévias e artes SVG autorais para as experiências.
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

Para o Portfolio: execute `npm run test:portfolio` e `CHROMIUM_PATH=/caminho/do/chromium node tests/portfolio-browser.cjs`. O workflow `USBRIN Portfolio — validação` confere a integridade, as interações e a responsividade (360, 390, 768 e 1366 px), além da regressão do Studio. Ele produz capturas de tela para revisão visual. A documentação de operação e pré-lançamento está em `docs/USBRIN-STUDIO-OPERACAO.md`.
