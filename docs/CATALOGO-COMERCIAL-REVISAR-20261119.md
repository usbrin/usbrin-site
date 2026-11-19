# USBRIN — revisão dos planos e preços do site oficial (19/11/2026)

## Fonte de produção verificada
Cloudflare Pages: projeto **usbrin-site**, integrado ao repositório GitHub `usbrin/usbrin-site` e à branch de produção `feature/usbrin-studio-mvp`.
Alterações desta revisão ocorreram **apenas** em `feature/usbrin-catalogo-comercial-revisao-20261119`, sem deploy nem merge em produção.

## Tabela vigente — nenhuma mudança de valor foi autorizada

| Oferta | Preço divulgado atualmente | Escopo |
| --- | ---: | --- |
| Landing Page | R$ 690 (único) | 1 página, até 6 seções |
| Site Business (antigo rótulo público: Institucional) | R$ 1.190 (único) | até 5 páginas |
| Catálogo Digital | R$ 1.790 (único) | até 20 produtos, sem checkout |
| USBRIN Publicação | R$ 149 (único) | publicação técnica |
| Registro USBRIN | R$ 99 (único) | assessoria de domínio |
| Publicação Completa | R$ 248 (único) | registro assistido + publicação |
| USBRIN Care | R$ 250/mês | manutenção opcional, conforme contrato |

### Adicionais em `js/studio-pricing.js`

| Adicional | Referência |
| --- | ---: |
| WhatsApp | incluso |
| Formulário avançado | R$ 150 |
| Galeria de projetos | R$ 180 |
| Blog gerenciável | R$ 450 |
| Página adicional | R$ 120 |

Todos são valores **de referência comercial**, não preços finais contratados em todos os casos. Não incluir automaticamente hospedagem, mensalidade ou domínio nos valores de desenvolvimento.

## Alterações seguras já preparadas
- O plano intermediário na home passa a usar o nome `Site Business`, em conformidade com o código e o nome comercial `USBRIN Business` no Studio. **Preço não alterado.**
- Novo teste `tests/commercial-catalog-sync.test.cjs` assegura que preços dos três planos coincidam com as estimativas base do Studio e que os links pré-preenchidos do WhatsApp não anunciem um valor diferente para os quatro serviços adicionais.
- O script `npm run test:pricing` passa a executar a verificação de consistência comercial, além dos cálculos do Studio.

## Atualizações pendentes de decisão comercial
Para alterar efetivamente **todos os valores**, a administração precisa fornecer os preços aprovados de cada item, indicar se pretende manter/remover/renomear algum plano e confirmar limites de escopo.

Ao receber a tabela, atualizar de maneira atômica **index.html**, **js/studio-pricing.js**, textos da área de representantes e **preços embutidos nos links WhatsApp**, e revisar testes e textos do Studio. Preservar a regra de comissão comercial existente até aprovação explícita de alterações contratuais.

**Nenhuma publicação no site oficial, nenhuma modificação de domínio e nenhuma alteração do USBRIN Studio além do teste de consistência.**
