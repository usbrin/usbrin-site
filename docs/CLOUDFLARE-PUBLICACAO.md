# USBRIN — publicação no Cloudflare Pages Free

## Escolha oficial de hospedagem — 30/10/2026
Cloudflare Pages Free para o **mesmo** repositório `usbrin/usbrin-site`, sem recriar o site ou substituir a identidade visual. O repositório GitHub continuará como fonte de código; o serviço de hospedagem passa de GitHub Pages para Cloudflare Pages, após a verificação.

O plano Free do Cloudflare Pages oferece distribuição gratuita e ilimitada de arquivos estáticos, sujeito aos limites da plataforma (atualmente 500 builds mensais). O site só gera páginas HTML, CSS, JavaScript e imagens — não usa Pages Functions, checkout ou processamento de cartões.

A integração Cloudflare Pages não está autorizada nem implantada automaticamente por esta alteração. É necessário conectar o GitHub na conta Cloudflare do proprietário e confirmar a URL real gerada pelo serviço.

## Implantação inicial sem alterar o site atual

1. Acesse https://dash.cloudflare.com/ e entre na conta Cloudflare. Abra **Workers & Pages** > **Create application** > **Pages** > **Connect to Git** (os rótulos podem variar).
2. Conecte o GitHub e autorize o repositório **`usbrin/usbrin-site`**. Não crie outro repositório.
3. Nome do projeto: **`usbrin-site`** se estiver disponível.
4. **Production branch (inicial):** `feature/usbrin-studio-mvp`. **Importante:** enquanto a PR #2 não tiver sido mesclada, `main` contém apenas o site anterior e não possui o script de build do Studio.
5. Framework preset: **None** / **No framework**.
6. Build command: **`npm run build`**.
7. Build output directory: **`dist`**.
8. Root directory: **`/`** (raiz do repositório).
9. Variáveis de ambiente: nenhuma obrigatória. Se pedir versão Node, escolha **22**. Não informe senhas ou tokens na configuração de build.
10. Clique em **Save and Deploy** e abra a URL **real** fornecida pelo Cloudflare (formato `https://<nome-confirmado>.pages.dev`). **Não invente esse endereço**: o nome pode estar ocupado e ser alterado.

### Checklist de homologação com o endereço confirmado

- Página inicial com logo original e chamada **Configurar meu site**.
- `/studio.html` com modelos Landing R$ 690, Institucional R$ 1.190, Catálogo R$ 1.790.
- Seleção de páginas, estilos, cores e funcionalidades; cálculos coerentes.
- `/privacidade.html`, demonstrativos de clínica, restaurante, construtora e imobiliária.
- Prévia conceitual celular/computador e ausência de rolagem horizontal.
- Solicitação de proposta: completar campos falsos de teste, revisar texto, conferir que o número de destino é **5569992967459**; **não envie mensagem real para realizar o teste**.
- Links de WhatsApp e e-mail só criados depois de a pessoa preencher e confirmar; nenhuma cobrança online.
- Valide o endereço canônico da homepage e sitemap com a URL Cloudflare; o script `scripts/build-static.cjs` usa `CF_PAGES_URL` para substituir o endereço antigo do GitHub Pages.
- Sem arquivos `/docs/` ou `/tests/` publicados, conforme build de lista autorizada.

### Consolidar o repositório depois de homologar

1. Mesclar **PR #2** na `main`, depois de confirmar que o Cloudflare está servindo o Studio corretamente e a revisão comercial/privacidade está aceita.
2. No painel Cloudflare, abrir **Settings > Builds > Branch control > Production branch** e mudar para `main`. Não trocar antes do merge, pois `main` ainda não possui o Studio.
3. Confirmar nova implantação de produção, revisar URL e link do Studio.
4. Retirar `noindex` da página Studio quando for a hora de permitir indexação por mecanismos de busca; isso não impede o acesso direto para clientes.
5. Se configurar domínio próprio, atualizar a variável de ambiente **`PUBLIC_SITE_URL`** com o endereço HTTPS definitivo e criar novo deploy para atualizar metadados e sitemap.
6. Somente após confirmar o endereço Cloudflare funcionando, atualizar link do Instagram e materiais comerciais. Não desativar o site anterior prematuramente.

## O que NÃO fazer

- Não pagar assinatura Vercel apenas para executar este site estático. Se a importação da Vercel ainda não foi concluída, pode deixar essa tela sem criar um projeto pago.
- Não escolher `main` como branch inicial junto com `npm run build`, porque a versão `main` ainda não inclui esse comando.
- Não criar um site novo em outra conta GitHub nem substituir as demonstrações.
- Não usar a URL de prévia como endereço definitivo antes de conferir o status de deploy.
- Não divulgar serviços não entregues: a estimativa não é um contrato, não temos backend de CRM ou pagamento.
- Não publicar credenciais ou número de cartão no GitHub.

## Critério de sucesso

Implantação Cloudflare **Success**, homepage e Studio abrem em HTTPS, quatro demonstrações acessíveis, preços iniciais corretos, briefing com prévia de WhatsApp, nenhum erro visível no celular e início da operação comercial com cinco contratos para medir margem/horas.

## Documentação oficial

- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/functions/pricing/
