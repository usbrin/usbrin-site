# USBRIN — Site oficial

Site estático em HTML, CSS e JavaScript, sem build e sem banco de dados. Repositório original: https://github.com/usbrin/usbrin-site

## Execução local

```sh
python3 -m http.server 8000
```

Abra http://localhost:8000. O servidor não é necessário em produção; publique apenas os arquivos do site, sem `.git`, testes ou documentação.

## Estrutura

- `index.html`: apresentação, quatro demonstrações, soluções, processo, FAQ nativo e formulário.
- `css/style.css`: identidade e responsividade.
- `js/main.js`: navegação, carrossel e interações visuais.
- `js/quote.js`: validação, prévia e composição do link WhatsApp.
- `demo-*.html`: quatro empresas fictícias, preservadas e identificadas.
- `assets/`: logos originais e derivados otimizados.
- `sitemap.xml`: endereço canônico da página principal; demos têm `noindex`.

## Contato e orçamento

WhatsApp: https://wa.me/5569992967459. E-mail: usbrin.contato@gmail.com.

O formulário exige nome, tipo e objetivo. Empresa, funcionalidades e detalhes são opcionais. Os dados ficam somente na página até o visitante abrir o WhatsApp. A prévia usa `textContent` e o texto do link usa `encodeURIComponent`; não existe envio automático, armazenamento, backend ou rastreamento adicionado. Ao editar um campo, a prévia anterior é invalidada. Sem JavaScript, os contatos diretos e FAQ continuam disponíveis.

O parâmetro `?demo=restaurante`, `construtora`, `clinica` ou `imobiliaria` acrescenta uma referência conhecida ao pedido. Outros valores são ignorados. Preços da USBRIN não são publicados; valores fictícios de pratos e imóveis permanecem nas demonstrações.

## Recuperação

Versão original: commit `63e47c868b6cd3b92fc8f25ecf9be61d4b57b550`, preservado na branch `backup/pre-optimization-2026-10-29`. Para desfazer a atualização, reverta o commit de integração por um novo commit, sem reescrever o histórico.

## Hospedagem

O GitHub Pages contém restrições para operar negócios e sites destinados principalmente a facilitar transações comerciais: https://docs.github.com/pt/pages/getting-started-with-github-pages/github-pages-limits . Antes de ampliar a operação comercial, confirme o enquadramento com o GitHub ou escolha uma hospedagem adequada. Não há checkout ou processamento de pagamento neste site.

Uma alternativa a avaliar é Cloudflare Pages: requisições de arquivos estáticos são gratuitas, inclusive no plano gratuito, sujeitas aos termos e limites da plataforma: https://developers.cloudflare.com/pages/functions/pricing/ . Nenhuma migração, contratação ou alteração de DNS faz parte desta atualização. Em eventual migração, atualizar canonical, Open Graph e sitemap. Não foi criado `robots.txt` nesta subpasta, pois robôs consultam esse arquivo na raiz do domínio.

## Testes

Instale Playwright no ambiente de desenvolvimento e disponibilize Chromium. Execute `CHROMIUM_PATH=/caminho/do/chromium node tests/browser.cjs`. O teste cria seu próprio servidor local na porta 8001 e não envia mensagens. Consulte `docs/VALIDACAO-2026-10-29.md` para resultados e limites.
