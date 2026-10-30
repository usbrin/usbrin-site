# USBRIN — Auditoria e validação, 29/10/2026

## Diagnóstico e prioridades

| Impacto | Evidência inicial | Correção |
|---|---|---|
| Alto | Contato restrito a links diretos, sem briefing estruturado | Formulário com prévia e link WhatsApp |
| Alto | Grade externa e interna duplicadas nos destaques das quatro demos; overflow da clínica em 320px | Grade única e colunas responsivas |
| Alto | Arquivos internos de um repositório Git copiados na raiz pública (`objects`, `logs`, `config`, etc.) | Removidos da árvore atual; versão anterior preservada |
| Médio | Menu fechava sem atualizar `aria-expanded` | Estado sincronizado, Escape, foco e fechamento ao mudar para desktop |
| Médio | FAQ e conteúdo com dependência desnecessária de JS | `details/summary` nativos e conteúdo visível por padrão |
| Médio | Hero pouco explícito e seção institucional redundante | Oferta mais direta e remoção da seção Sobre |
| Médio | Miniaturas abstratas e ausência de referência no orçamento | Capturas das demos existentes e CTA contextual |
| Médio | Sem canonical, Open Graph ou sitemap | Metadados e sitemap da home; demos `noindex` |
| Baixo | PNGs grandes para logos e favicon | Derivados WebP e favicon reduzido; originais preservados |

## Estado funcional

| Recurso | Estado | Evidência |
|---|---|---|
| Formulário de orçamento | Implementado | Nome/tipo/objetivo obrigatórios; campos opcionais; sete categorias; validação no navegador |
| Mensagem WhatsApp | Implementado | Destinatário original, `encodeURIComponent`, prévia com `textContent`, sem envio automático |
| Referência da demonstração | Implementado | Lista fechada de quatro parâmetros; desconhecidos ignorados |
| Contato direto | Implementado/preservado | WhatsApp e e-mail originais, inclusive sem JS |
| Portfólio | Implementado | Quatro páginas e links preservados; capturas reais, aviso fictício, CTA por segmento |
| Menu e FAQ | Implementado | Cliques, Escape e estados; FAQ funciona sem JS |
| Responsividade | Implementado | Cinco páginas em 320, 390, 768, 1024 e 1440px sem overflow horizontal |
| SEO técnico básico | Implementado | Título, descrição, canonical, Open Graph, hierarquia, sitemap; sem promessa de ranking |
| Performance | Parcialmente validada | Imagens menores e lazy loading; não foi executado Lighthouse nem medição em rede móvel real |
| Acessibilidade | Parcialmente validada | Labels, fieldset, foco, skip link, FAQ nativo, teclado; sem auditoria completa com leitor de tela |
| Hospedagem comercial | Pendente de decisão | Restrições do Pages documentadas no README; nenhuma migração/DNS |

## Testes executados

`node tests/browser.cjs` com Playwright e Chromium headless 153, em ambiente local. **154 verificações aprovadas; zero erros JavaScript capturados**.

- 25 combinações de página/largura: ausência de overflow, um h1 por página e âncoras existentes.
- Menu mobile abre, fecha pela seleção, atualiza ARIA e fecha por Escape.
- FAQ abre/fecha e funciona com JavaScript desabilitado.
- Nome vazio e nome apenas com espaços bloqueados; categoria/objetivo obrigatórios.
- Sete categorias, dados opcionais vazios, funcionalidades selecionadas e contexto da clínica.
- Acentos, emoji, `&`, `+`, `%`, `#` e texto com marcação HTML preservados na mensagem sem executar HTML.
- Mensagem decodificada do URL idêntica à prévia; número oficial conferido.
- Edição invalida a prévia e remove o link anterior.
- Carrossel avança e retorna.
- Links e recursos internos respondem com sucesso no servidor local; miniaturas decodificadas.
- Home, formulário e portfólio inspecionados por capturas desktop e mobile; inspeção adicional confirmou miniaturas após decodificação e pintura.
- `node --check` para os scripts e `git diff --check`.

As fontes do Google retornaram `ERR_EMPTY_RESPONSE` no navegador local. A renderização inspecionada utilizou fallback. As famílias originais permanecem declaradas; a disponibilidade externa não está garantida por estes testes. As capturas das demonstrações também usam fallback.

Não foram enviados pedidos reais, mensagens ou e-mails. O teste verifica composição e destino do link; entrega/recebimento no WhatsApp e funcionamento do aplicativo de e-mail não foram testados. Não foi feita auditoria de compatibilidade Safari/Firefox nem teste em aparelho físico.

## Arquivos

Alterados: `index.html`, `css/style.css`, `js/main.js`, os quatro `demo-*.html` e `README.md`.

Adicionados: `js/quote.js`, `sitemap.xml`, `tests/browser.cjs`, este relatório, `assets/favicon-small.png`, dois logos `.webp` e quatro `assets/preview-*.webp`.

Removidos apenas artefatos de Git indevidamente copiados para a raiz: `COMMIT_EDITMSG`, `HEAD`, `config`, `description`, `index`, `hooks/`, `info/`, `logs/`, `objects/` e `refs/`. O diretório real `.git` e o histórico permanecem intactos.

## Recuperação e publicação

Backup: branch `backup/pre-optimization-2026-10-29`, commit `63e47c868b6cd3b92fc8f25ecf9be61d4b57b550`.

A publicação deve ser confirmada no endereço https://usbrin.github.io/usbrin-site/ após integração. A existência deste relatório no repositório não comprova que o deploy foi concluído; o resultado final da execução registra a verificação pública.

## Próxima etapa comercial

Validar a oferta com conversas e propostas antes de investir em tráfego. Registrar por cliente: origem, escopo, horas previstas/reais, proposta e fechamento. Limitar revisões e manutenção por escrito, separar domínio/hospedagem e tratar e-commerce como orçamento específico. Medir margem por projeto e horas de suporte, sem instalar rastreamento nesta entrega.
