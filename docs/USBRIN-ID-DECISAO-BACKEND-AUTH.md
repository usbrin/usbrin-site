# USBRIN ID — decisão técnica pendente: backend do login próprio (19/11/2026 UTC)

## Requisito imutável da experiência
Na USBRIN, o usuário vê apenas a página própria de **e-mail e senha**, sem uma etapa visível de autenticação no Cloudflare Access ou ZITADEL. Os três perfis existentes (administrador, representante, desenvolvedor) e as permissões do portal devem ser preservados.

## Resultados verificados
- O QA próprio `usbrin-id-native-qa.pages.dev` foi publicado com sucesso no Cloudflare Pages (GitHub Actions 44455386762). Banco D1 `usbrin_id_native_qa` isolado e vazio, migrações 0001–0018 aplicadas; inscrições e e-mails desativados; `fail_open=false`.
- Validação HTTP externa via GitHub Actions 44455825690: `/login` e `/senha` respondem **200**; `/portal` e `/proposta` respondem **302** para login; `/js/portal.js` e `/api/private/me` respondem **401**; atalhos HTML privados também permanecem protegidos.
- A tentativa de login com endereço totalmente fictício (sem qualquer usuário registrado) retornou **HTTP 503 em ~0,34 s**, não o **401** esperado. O banco não registrou tentativas nem criou sessões. O erro foi capturado pelo fail-closed do aplicativo; a categoria exata de exceção não foi obtida no tail do projeto com a credencial de CI atual.
- A implementação nativa chama `crypto.subtle.deriveBits` com **600.000 iterações PBKDF2-SHA256**. Há evidências públicas concretas de que Cloudflare Workers **rejeita acima de 100.000 iterações** (`NotSupportedError`). Portanto, essa é a **causa provável**, ainda não confirmada por stack trace. Além disso, Workers Free limita o tempo de CPU por chamada a 10 ms. Reduzir o custo da senha para se adequar ao Free não é uma correção aceitável para a USBRIN ID.

## Opção A — recomendada: aproveitar o ZITADEL já configurado, mantendo a UI da USBRIN
A documentação oficial do ZITADEL prevê uma **Custom Login UI com usuário e senha utilizando a Session API V2**. A integração OIDC do ZITADEL já existe no ambiente de QA do Cloudflare Access, com origem `https://usbrin-id-rzf8mn.us1.zitadel.cloud`.

Desenho recomendado para análise:
1. Login por e-mail e senha **dentro do site USBRIN**, enviado apenas ao backend via HTTPS.
2. O backend da USBRIN valida a senha pelo **ZITADEL Session API** e gerencia um cookie seguro de sessão de aplicativo. O ZITADEL armazena/verifica credenciais e aplica políticas de MFA, sem exigir que a pessoa passe pela interface do Cloudflare Access.
3. A D1 local permanece como fonte de autorização (perfis, conta ativa/suspensa, aprovação e trilha de auditoria); não guardar novos hashes de senha no D1.
4. Primeiro acesso/redefinição de senha devem usar o mecanismo de identidade de ZITADEL, com integração adequada ao portal; não manter duas fontes de senha.
5. Exigir verificação administrativa reforçada para ações sensíveis, sem multiplicar telas desnecessárias para representantes.
6. **Necessário verificar** permissões de Login Client/Session API na instância ZITADEL e capacidade/limites do plano atual. Pode exigir criação de credencial de serviço e secrets pelo ambiente seguro; não presumir API liberada ou uso sem custo.

Referências oficiais: `https://zitadel.com/docs/guides/integrate/login-ui/username-password`, `https://zitadel.com/docs/guides/integrate/login/login-users`, `https://zitadel.com/docs/guides/integrate/login-ui`.

## Opção B — autenticação e senhas inteiramente no D1, usando biblioteca KDF auditada
- Substituir WebCrypto PBKDF2 acima do limite por implementação de KDF compatível e auditada (por exemplo, `@noble/hashes` com algoritmo e parâmetros revisados).
- Testar custo de CPU em implantação de QA e configurar capacidade apropriada. Workers Paid custa **mínimo US$ 5/mês por conta** antes de uso excedente, se a conta ainda não estiver nesse plano. **Não contratar ou ativar plano pago sem aprovação expressa**.
- A USBRIN assumiria a operação dos hashes, rotação de segredos, reset de senhas, análise de abuso, logs e conformidade, além do desenvolvimento contínuo.

Referências: `https://developers.cloudflare.com/workers/platform/limits/`, `https://developers.cloudflare.com/workers/platform/pricing/`.

## Gate
**Não liberar o login nativo para contas reais, não abrir inscrições e não alterar produção enquanto a opção de backend não for definida e validada em QA.** O PR #11 permanece rascunho. Os testes locais verdes não substituem o fluxo real do provedor.

## Limites da investigação
O resultado HTTP 503 em QA demonstra uma falha funcional; a exceção interna precisa de evidência adicional para atribuição definitiva. A API do Cloudflare Access informa a existência da conexão ZITADEL, mas não concede automaticamente permissão para usar a Session API. Não afirmar que essa integração já foi realizada.
