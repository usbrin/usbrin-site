# USBRIN — lançamento integrado e campanha de representantes
**Versão para homologação · 19/11/2026 · NÃO AUTORIZA PUBLICAÇÃO EM PRODUÇÃO**

## Escopo aprovado
- **Manter todos os preços e condições comerciais atuais.**
- Reunir o site oficial e suas páginas comerciais com USBRIN Studio, USBRIN Parceiros e USBRIN ID, preservando o layout, o logotipo e a experiência de login próprio.
- Preservar integralmente o **portfólio oficial com 50 demonstrações**, seus arquivos, estilos, scripts e links. Não substituir a homepage atual por uma versão antiga da USBRIN ID.
- Primeira campanha pública: **somente representantes comerciais**. A modalidade desenvolvedor permanece fechada.
- O envio do formulário é uma **candidatura**, jamais aprovação automática, acesso, vínculo empregatício ou garantia de comissão.
- Preparar a publicação para avaliação do proprietário; **não realizar merge, atualização no domínio oficial ou abertura de inscrições sem aprovação expressa**.

## Tabela comercial preservada
| Item | Preço de referência |
|---|---:|
| Landing Page (1 página, até 6 seções) | R$ 690 |
| Site Business (até 5 páginas) | R$ 1.190 |
| Catálogo Digital (até 20 itens, sem checkout) | R$ 1.790 |
| USBRIN Publicação | R$ 149 |
| Registro USBRIN | R$ 99 |
| Publicação Completa | R$ 248 |
| USBRIN Care, opcional | R$ 250/mês |
| Página extra no Studio | R$ 120 |
| Formulário avançado | R$ 150 |
| Galeria | R$ 180 |
| Blog | R$ 450 |
| WhatsApp | incluso |

Valores são referências para escopos definidos e sujeitos à proposta definitiva quando houver personalizações. Nunca prometer preços ou comissões diferentes dos aprovados.

## Telas e fluxo
1. **Site oficial:** home com a mesma tabela de preços, apresentação do Studio e link "Trabalhe com a USBRIN".
2. **/parceiros:** campanha focada em representantes e em benefícios profissionais reais, sem promessa de rendimento, apresentando processo seletivo e a área de acesso.
3. **/candidatura?area=representante:** formulário com nome, e-mail, WhatsApp, localização, experiência, motivação, consentimento LGPD e Turnstile.
4. **/status-candidatura:** consulta protegida por e-mail, protocolo e desafio.
5. **Análise administrativa:** candidatura é recebida e auditada, depois avaliada. Nenhum candidato recebe login automaticamente.
6. **Aprovação:** profissional aprovado tem identidade **explicitamente** vinculada entre ZITADEL e conta USBRIN; as permissões são aplicadas no backend.
7. **/login:** e-mail/senha diretamente na USBRIN ID, com TOTP para administradores; representante vai ao **/portal**.

## Proteções desenvolvidas nesta branch
- `APPLICATIONS_ENABLED=false` continua sendo o estado seguro: nenhum formulário deve operar por simples publicação do código.
- Uma nova abertura de representantes usa **exclusivamente** `REPRESENTATIVE_APPLICATIONS_ENABLED=true` e `REPRESENTATIVE_APPLICATIONS_HOST` igual ao hostname público exato. O servidor exige D1 + segredo Turnstile + site key. `APPLICATIONS_ENABLED` permanece **false** para não abrir também desenvolvedores.
- `public-config` e inserção respeitam essas condições; previne ativação em domínio ou preview incorreto.
- **Acompanhamento após o fechamento:** `REPRESENTATIVE_STATUS_ENABLED=true`, no mesmo hostname exato configurado em `REPRESENTATIVE_APPLICATIONS_HOST`, permite apenas consultar protocolos existentes mesmo com `REPRESENTATIVE_APPLICATIONS_ENABLED=false`. Continua exigindo D1, Turnstile e e-mail + protocolo e nunca abre novas candidaturas.
- Turnstile é validado **no backend**, incluindo hostname e ação do desafio; há validação de campos, consentimento e prevenção de candidaturas ativas duplicadas.
- Início do formulário não cria usuário, senha nem sessão; aprovação e ativação continuam sendo operações de acesso controlado.
- Arquivos protegidos do portal não podem ser copiados para `/public/`.

## Ambientes reais — conferidos em 19/11/2026
- `usbrin-site` é o projeto Pages atualmente associado ao site oficial, com branch de produção `feature/usbrin-studio-mvp`. Não possui hoje D1 nem variáveis/segredos de autenticação registrados em sua configuração de produção. **Não publicar este bundle sem configurar controles e ambiente definitivos.**
- `usbrin-id-native-qa` é o ambiente isolado de autenticação real (ZITADEL + D1 QA), sem reset de senha ou inscrição real. Um widget Turnstile QA dedicado ao host `usbrin-id-native-qa.pages.dev` foi criado, com `TURNSTILE_SECRET` armazenado como Cloudflare Secret. As flags `REPRESENTATIVE_APPLICATIONS_PREVIEW` e `ACCESS_APP_HOST` habilitam somente candidaturas de representante com **e-mail fictício `@example.com`**; não aceitar e-mails reais. `APPLICATIONS_ENABLED=false` continua ativo. Essa prévia será validada manualmente antes de considerar o fluxo homologado.
- `usbrin-partners-qa` é um projeto antigo de testes do programa de parceiros, com inscrições desativadas e sem ser origem de produção.
- Branch de homologação `feature/usbrin-lancamento-integrado-qa-20261119`, derivada da tipografia homologada, com home e tabela comercial alinhadas à branch do site oficial. Mantém a versão mais recente do Studio com formulário opcional de contato.

## Gates antes de divulgar e receber dados reais
- [ ] Validar visualmente a versão QA do site, do Studio, do login e das páginas de representantes em desktop/celular.
- [ ] Confirmar no ambiente definitivo **arquitetura e roteamento** (site Pages atual, integração via Pages Functions, DNS `usbrin.com.br` e `www` se aplicável). Evitar apontar login para subdomínio QA.
- [ ] Configurar **D1 de produção separado** do D1 de homologação, com migrações aplicadas e backup, e binding `USBRIN_ID_DB`. Nunca copiar contas fictícias para produção.
- [ ] Configurar credenciais ZITADEL para produção por **segredos da Cloudflare**, nome de host e origem autorizados. Não reutilizar cegamente o PAT do QA.
- [ ] Criar usuário administrativo operacional **específico**, com TOTP real testado, processo de ativação, suspensão, recuperação e auditoria. A aprovação de candidatos não pode depender de credenciais da conta proprietária do ZITADEL.
- [ ] Configurar Turnstile na página de inscrições definitiva; salvar `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET` somente na configuração adequada. Confirmar hostname, proteção antispam e fluxo de duplicatas.
- [ ] Habilitar recuperação de senha somente após provar envio de e-mail no ZITADEL, política de remetente e fluxo de redefinição real.
- [ ] Definir política de encerramento: desativar `REPRESENTATIVE_APPLICATIONS_ENABLED`, mas manter `REPRESENTATIVE_STATUS_ENABLED` para consulta das candidaturas recebidas durante a avaliação.
- [ ] Revisar aviso LGPD, prazo de retenção de candidatos, política de exclusão, contatos e termos comerciais da campanha.
- [ ] Testar jornada completa: inscrição → protocolo → status → avaliação → aprovação → vinculação da identidade → login → painel → logout/suspensão.
- [ ] Definir monitoramento de erros, limitações de abuso, rotação do PAT (vence em **19/12/2026**) e rollback.
- [ ] **Aprovação expressa** do responsável USBRIN para publicar e depois habilitar `REPRESENTATIVE_APPLICATIONS_ENABLED=true` em hostname oficial. Não habilitar `APPLICATIONS_ENABLED=true` na primeira campanha.

## Textos de campanha preparados para revisão

**Instagram — publicação inicial**
> Estamos preparando uma nova etapa da USBRIN Parceiros! 💜 Buscamos pessoas interessadas em representar nossas soluções digitais, conhecer empresas e ajudar negócios a fortalecer sua presença online. A seleção terá inscrição, análise de perfil e condições de colaboração apresentadas aos aprovados. Acompanhe o lançamento das candidaturas em usbrin.com.br/parceiros. **USBRIN — Sua solução digital.**

**Post de abertura (usar SOMENTE após ativação verificada do formulário)**
> As candidaturas para representantes comerciais da USBRIN estão abertas! 🚀 Você gosta de conversar com empresas e apresentar soluções digitais? Conheça o programa, os critérios e envie sua candidatura em **usbrin.com.br/parceiros**. A seleção envolve análise e formalização; o envio não gera contratação automática ou garantia de remuneração. **USBRIN — Sua solução digital.**

**Stories**
> Quer representar soluções digitais da USBRIN? Conheça o programa e o processo seletivo em usbrin.com.br/parceiros. *Inscrições sujeitas à abertura oficial.*

Não há compra de anúncios, disparo de campanhas, contratação de serviços pagos nem publicação em redes sociais neste estágio.
