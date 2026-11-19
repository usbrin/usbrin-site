# USBRIN ID — Acesso próprio por e-mail e senha (piloto)

## Decisão de produto
A experiência planejada para candidatos aprovados, representantes, desenvolvedores e administração passa a ser uma página própria da USBRIN, com dois campos (`e-mail` e `senha`), sem redirecionamento diário ao Cloudflare Access ou ZITADEL. A infraestrutura Cloudflare permanece como hospedagem e camada de rede, não como login visível.

Este documento descreve **uma implementação inicial em branch isolada** e **não autoriza implantação em produção**.

## Implementado na branch
- `login.html`, `js/login.js`, `css/login.css`: formulário próprio, responsivo, sem envio de senha por URL.
- `functions/_lib/native-auth.js`: validação no backend, derivação PBKDF2-SHA256 com salt por usuário, 600 mil iterações e segredo de ambiente; hashes persistidos, nunca senhas em texto puro.
- Sessões via token aleatório de 256 bits armazenado apenas como hash SHA-256 no D1; cookie `__Host-usbrin-native` com `Secure`, `HttpOnly`, `SameSite=Lax`, expiração de 12 horas e inatividade de 30 minutos.
- Login limita tentativas repetidas e retorna erro genérico para conta ausente/suspensa/senha incorreta.
- `functions/api/native/login.js` e `logout.js` exigem HTTPS, host exato, origem correspondente e métodos HTTP específicos. Logout revoga a sessão no banco.
- `auth.js` reutiliza a mesma matriz de permissões por usuário/role vigente. O modo local exige `USBRIN_AUTH_MODE=native`, `NATIVE_AUTH_HOST`, `USBRIN_ID_DB` e `USBRIN_PASSWORD_PEPPER`; sem esses parâmetros o login local permanece indisponível, sem fallback inseguro.
- A migração `0017_native_credentials.sql` acrescenta tabelas sem modificar registros existentes. **Não foi aplicada a nenhum banco**.

## Itens obrigatórios antes de habilitar contas reais
1. Definir como o primeiro administrador poderá registrar uma senha de forma legítima, sem credenciais padrão, sem copiar senhas no chat e sem criar endpoint público de administrador. Recomendação: convite único entregue a um endereço previamente verificado, com validade curta, consumo único e trilha de auditoria.
2. Implementar a criação/redefinição de senha por link único enviado ao e-mail previamente cadastrado, expiração do convite e invalidação das sessões após troca.
3. Validar os critérios de senha e proteção contra ataques automatizados (rate limiting por aplicação e, quando pertinente, WAF no Cloudflare) e revisar e testar rotas públicas/privadas antes de remover a proteção antiga do ambiente.
4. Avaliar controles reforçados para o perfil administrador, pois só e-mail/senha aumenta o risco de acesso indevido a dados financeiros e candidaturas.
5. Criar ou escolher **um ambiente QA separado** sem o Access interceptando os endpoints nativos, com banco **exclusivo QA** e segredo de ambiente próprio. Não reutilizar o ambiente público nem alterar as políticas Access atuais antes de concluir a homologação.
6. Aplicar a migração somente no QA explicitamente escolhido, inspecionar o schema e registrar a possibilidade de rollback. Definir segredos em configurações privadas da Cloudflare, nunca no GitHub.
7. Executar a suíte de testes e testes reais de uso, logout, cookies, bloqueio de contas suspensas, recuperação de senha, autorização entre perfis e responsividade.
8. Apenas após aprovação expressa, preparar DNS/rotas do site oficial e liberar a página `/login`; preservar o acesso antigo como opção de rollback por período definido.

## Separação operacional
- **Candidaturas**: permanecem fechadas (`APPLICATIONS_ENABLED=false`); inscrição não cria conta ativa ou credencial automaticamente.
- **Ativação**: requer análise, aprovação e documentação. Só então o sistema emitirá um convite único para definição da senha.
- **Usuário aprovado**: no uso cotidiano, acessa e-mail e senha dentro da USBRIN; recuperação de senha é um fluxo eventual.
- **Administrador**: analisa candidaturas, autoriza representantes e mantém trilha de auditoria e medidas de proteção apropriadas.

## Estado atual
Há um protótipo técnico e testes automatizados na branch `feature/usbrin-id-login-proprio-20261118`; ele não permite login real sem provisionamento seguro de credenciais, banco QA migrado e configuração explícita. Não afirmar que o ambiente já está publicado ou homologado.
