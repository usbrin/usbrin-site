# ARQUIVADO — hospedagem não selecionada para o lançamento

A USBRIN escolheu **Cloudflare Pages Free** para a publicação inicial. As instruções ativas estão em `docs/CLOUDFLARE-PUBLICACAO.md`. Este arquivo permanece apenas como referência histórica, não deve ser seguido para o lançamento atual.

---

# Publicar USBRIN + USBRIN Studio na Vercel

## Situação em 30/10/2026
- Site oficial permanece operando no repositório `usbrin/usbrin-site`.
- USBRIN Studio preparado na PR: https://github.com/usbrin/usbrin-site/pull/2
- Precificação do piloto aprovada: Landing R$ 690; Business R$ 1.190; Catálogo R$ 1.790. A proposta definitiva continua após análise técnica.
- Código e testes de build preparados para Vercel. **Não confundir isso com implantação confirmada.**

## Sequência segura
1. Em https://vercel.com/new, selecione GitHub e importe o repositório **existente** `usbrin/usbrin-site`. Não crie um novo repositório ou outro site independente; mantenha toda a estrutura original.
2. Escolha Framework Preset **Other**, diretório raiz do repositório (`./`). As configurações estão em `vercel.json`: `npm run build` e saída `dist`.
3. A importação padrão lê `main`. O primeiro deploy pode mostrar **apenas o site atual** — isso é esperado, pois o Studio está na PR. Ainda não divulgue essa URL.
4. Verifique no projeto da Vercel que o GitHub está conectado. Uma alteração na branch `feature/usbrin-studio-mvp` deverá gerar uma implantação de prévia. Se não gerar, use **Deployments → Create Deployment** e selecione essa branch ou o commit dela. Não marque essa prévia como produção.
5. Confirme a prévia real: `/studio.html`, `/privacidade.html`, quatro demonstrações, páginas e opções, preços (690 / 1190 / 1790), URL de compartilhamento, briefing e WhatsApp. Confira celular e desktop. Não envie dados de cliente real durante o teste.
6. Depois de aprovar a prévia, mescle a PR #2 para `main`. A Vercel deve então publicar automaticamente uma implantação de produção. Verifique o status **Ready** e abra a URL real.
7. Com o domínio de produção confirmado, valide tags `canonical` e sitemap, links de todas as demonstrações, termos da hospedagem e HTTPS. Caso use domínio próprio, configure o domínio na Vercel e em DNS de forma controlada, sem apagar serviços existentes.
8. Redirecione o tráfego antes direcionado ao antigo endereço somente após todos os testes. Monitore contatos e conversões dos cinco primeiros contratos.

## Restrições e segurança
- O GitHub Pages possui limites de uso para negócios transacionais; não utilizá-lo como hospedagem comercial definitiva.
- Não exponha credenciais, tokens da Vercel ou segredos em código, commits ou nesta conversa.
- Não invente URL pública; só compartilhar endereço confirmado com deploy Ready.
- O Studio não tem painel privado de CRM nem processamento de pagamentos.
- Não substituir a URL do site ou remover o site antigo antes de testar a nova hospedagem.

## Equipe e medição
Registrar para os cinco contratos iniciais: preço final, horas reais, gastos adicionais, revisões, margem e objeções comerciais. Os preços-base são apenas porta de entrada para serviços padronizados.
