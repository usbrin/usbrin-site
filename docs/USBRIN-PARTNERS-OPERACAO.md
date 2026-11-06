# USBRIN Partners · Guia de implantação e homologação

## Estado da entrega
- Branch isolada: `feature/usbrin-partners-platform`, baseada em `feature/usbrin-studio-mvp`.
- O site de produção existente não foi substituído.
- Cloudflare Pages constrói `dist` com `npm run build`; rotas da API utilizam Pages Functions.
- Banco D1 de homologação: `usbrin_partners_preview`, exclusivamente associado ao ambiente **preview** pelo binding `DB`. Não contém clientes ou candidaturas reais.
- Migração SQL `migrations/0001_partners.sql` aplicada apenas ao D1 de homologação.
- `APPLICATIONS_ENABLED=false` em preview. Nenhuma candidatura é aceita até liberação explícita, conclusão da privacidade e antifraude.
- Cloudflare Access **não está habilitado na conta**: áreas administrativas e privadas deverão negar acesso até a configuração legítima.

## Entregas no código
1. `parceiros.html`: programa comercial e desenvolvedores.
2. `candidatura.html`, `js/candidatura.js`: formulário validado, antispam Turnstile, recibo com protocolo.
3. `portal.html`, `js/portal.js`: interfaces de administração, representante e desenvolvedor.
4. `functions/api/applications.js`: recebimento de inscrições, D1, validação de origem, verificação Turnstile e bloqueio se faltar configuração.
5. `functions/api/private/[[path]].js`: consulta, revisão e ativação de candidatos; leads por proprietário; metas, vendas e comissões; projetos e remuneração técnica; trilha de auditoria.
6. `functions/_lib/auth.js`: validação criptográfica do JWT Cloudflare Access (RS256, emissor, público/audiência, prazo) e função derivada **somente** do usuário aprovado em D1.
7. `migrations/0001_partners.sql`: tabelas separadas, chaves estrangeiras, índices.
8. `privacidade-parceiros.html`: **texto preliminar**, não liberado juridicamente.
9. Testes automáticos via `.github/workflows/partners-validation.yml`.

## Antes de permitir candidatos reais
1. Revisar o aviso de privacidade, prazo de retenção, processo seletivo e contratos com orientação jurídica.
2. Criar/configurar um widget Cloudflare Turnstile para o domínio de prévia (ou homologação dedicado). No **preview** configurar:
   - `TURNSTILE_SITE_KEY`: site key pública;
   - `TURNSTILE_SECRET`: secret_text, **nunca expor no GitHub**;
   - `APPLICATIONS_ENABLED`: iniciar com `false`, alterar para `true` somente após testar.
3. Aplicar a migração versionada no banco específico de produção antes do primeiro lançamento. **Nunca reutilizar o D1 de preview em produção.**
4. Definir consentimentos ou outras bases legais adequadas; não usar informações de candidatos para finalidades não informadas.
5. Testar um cadastro real controlado na homologação, conferir existência no D1, protocolo e tratamento de duplicidade.

## Antes de habilitar o portal restrito
1. Habilitar Cloudflare Access na conta, verificar requisitos e custos, e criar uma **aplicação Access** protegendo `/portal.html` e **toda a rota** `/api/private/*`; verificar também todos os endereços de preview/produção que possam servir essas rotas.
2. Criar políticas para identidades aprovadas; ativar MFA para contas administrativas.
3. Configurar no Pages Preview (não no código) `ACCESS_TEAM_DOMAIN` no formato `https://seu-time.cloudflareaccess.com` e `ACCESS_AUD` com o AUD exato da aplicação criada.
4. Criar o administrador inicial em D1 **somente após identificar e verificar a conta autorizada**. Exemplo SQL com valores substituídos:
   `INSERT INTO users(id,email,name,role,status) VALUES ('UUID_GERADO','email_admin_verificado','Administrador USBRIN','admin','active');`
5. Conferir falhas de acesso sem login, com JWT inválido, com usuário desativado, entre representantes distintos e entre desenvolvedores.
6. Confirmar a política contratual de remuneração, direitos de cancelamento e critérios de exigibilidade antes de pagar comissões.

## Ressalvas e limites do MVP
- O backend possui endpoints e telas para administração, mas **não** representa folha de pagamento, ERP ou software contábil certificado.
- Não há processamento bancário automático, assinatura eletrônica, e-mail transacional ou ativação automática de usuários.
- Registro de venda e pagamento depende de conciliação pela administração.
- A experiência de candidatura está fechada por padrão para impedir coleta prematura de dados.
- O painel não foi testado com usuários reais, pois o Access não está habilitado.
- Faltam testes completos ponta a ponta com identidades reais; sem isso, não deve ser publicado como sistema pronto.
- Avaliar endurecimento de integridade transacional e de concorrência para recibos e comissões antes de volume expressivo.
- A capacidade de entrega da USBRIN e a revisão das condições comerciais permanecem decisões empresariais, não automações.

## Verificação
- Rodar `npm run build`.
- Rodar `node --test tests/studio-pricing.test.cjs`.
- Validar `node --check` em cada JavaScript novo.
- Rodar migrações em SQLite temporário.
- Conferir a execução de `USBRIN Partners — Validation` em Actions.
- Inspecionar UX em desktop e celular, caminhos do Studio e Store antes de merge.
- Confirmar que `/api/public-config` retorna `applicationsOpen:false` até ativação e que endpoints privados retornam erro de autorização sem Access.
- Não mesclar ou alterar a branch de produção até aprovação expressa da administração, testes e revisão jurídica.

## Operação sugerida
Abrir primeiro candidaturas controladas; selecionar até três representantes e um ou dois desenvolvedores; revisar a conversão, a margem de cada plano, a qualidade das entregas e o suporte antes de ampliar a rede.
