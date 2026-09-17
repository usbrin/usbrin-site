# USBRIN — Site comercial

Site institucional/comercial da USBRIN, criado para ser usado como ferramenta de vendas (apresentação em desktop e, principalmente, no celular, direto para empresários).

Site estático, sem build, sem dependências de servidor — basta abrir os arquivos `.html` em qualquer navegador ou publicar em qualquer serviço de hospedagem estática.

## Estrutura do projeto

```
usbrin/
├── index.html                 → site principal (uma página, com âncoras por seção)
├── demo-restaurante.html      → case demonstrativo: Brasa & Mesa
├── demo-construtora.html      → case demonstrativo: Alto Norte Engenharia
├── demo-clinica.html          → case demonstrativo: Vitta Clínica
├── demo-imobiliaria.html      → case demonstrativo: PrimeLar Imóveis
├── css/
│   └── style.css              → design system e estilos do site principal
├── js/
│   └── main.js                → menu mobile, FAQ, scroll reveal, header, carrossel
└── assets/
    ├── usbrin-logo.png             → logo original enviada (fundo preto)
    ├── usbrin-logo-transparent.png → logo com fundo removido (uso em telas grandes)
    ├── usbrin-logo-cropped.png     → logo recortada, usada no header/footer
    └── favicon.png                 → ícone da aba do navegador
```

As 4 páginas de demonstração são **autocontidas** (CSS embutido em cada arquivo), com identidade visual própria para cada segmento — elas representam a *entrega final* que um cliente da USBRIN receberia, por isso não usam a paleta/tipografia da USBRIN. Cada uma tem uma barra fixa no topo identificando "Case demonstrativo criado pela USBRIN" com link de volta para `index.html`.

## Seções do site principal (`index.html`)

1. **Início** — hero de alto impacto: percepção de valor primeiro, com composição visual (notebook + celular, com leve tilt 3D ao mover o mouse)
2. **Problema** — por que uma presença digital fraca reduz percepção de valor e credibilidade
3. **Possibilidade** — nova seção de transição: mostra que existe um caminho melhor (design personalizado, responsivo, processo simples, suporte)
4. **Demonstrações (Cases)** — vitrine dos 4 cases fictícios, com CTA intermediário logo abaixo
5. **Soluções** — 8 segmentos atendidos + nota sobre expansão futura (sem prometer o que ainda não é oferecido)
6. **Como funciona** — processo em 4 etapas, com linha de progresso animada + CTA para preços
7. **Preços** — 3 planos + USBRIN Care (manutenção mensal)
8. **Sobre**
9. **FAQ** — acordeão, com respostas revisadas sobre hospedagem e rodadas de ajuste
10. **Contato (CTA final)** — WhatsApp e e-mail, com botão flutuante de WhatsApp em todas as páginas

### Microinterações (v2.0)
- **Spotlight**: leve brilho que segue o cursor nos cards (cases, segmentos, preços, possibilidade) — desativado automaticamente em touch e com `prefers-reduced-motion`
- **Tilt do hero**: a composição do hero se inclina sutilmente conforme o mouse se move, sem conflitar com a flutuação (float) já existente dos mockups
- **Linha de progresso**: a linha do "Como funciona" se preenche com a cor de destaque ao entrar na tela

## Como publicar

### Opção 1 — GitHub Pages
1. Suba este conteúdo para um repositório no GitHub.
2. Em **Settings → Pages**, selecione a branch principal e a pasta raiz (`/`).
3. O site ficará disponível em `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`.

### Opção 2 — Qualquer hospedagem estática
Basta enviar a pasta inteira (Netlify, Vercel, cPanel, etc.). Não há passo de build.

### Domínio próprio
Depois de publicar, aponte o domínio (ex. `usbrin.com.br`) para o serviço escolhido e configure o CNAME/registro conforme a documentação da hospedagem.

## Contato configurado no site
- WhatsApp: `(69) 9 9296-7459` → `https://wa.me/5569992967459`
- E-mail: `usbrin.contato@gmail.com`

Para alterar esses dados no futuro, procure por `992967459` e `usbrin.contato@gmail.com` em `index.html` — eles aparecem no bloco de contato, no rodapé e no botão flutuante de WhatsApp.

## Notas técnicas
- Fontes carregadas via Google Fonts (`Space Grotesk` + `Inter` no site principal; cada demonstração usa uma dupla de fontes própria).
- Ícones são SVGs escritos à mão (sem dependência de bibliotecas externas).
- Sem frameworks, sem etapa de build — HTML/CSS/JS puro.
- Testado em telas de 390px (mobile) e 1440px (desktop) com rolagem completa.
