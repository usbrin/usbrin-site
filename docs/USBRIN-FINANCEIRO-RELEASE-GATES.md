# USBRIN — Financeiro: política operacional, integridade e critérios de lançamento

Status: **HOMOLOGAÇÃO (não usar como livro oficial)**. Site oficial e credenciais de produção preservados.

## Escopo funcional do Financeiro

1. **Receita de criação de sites** — propostas são rascunhos até aprovação; vendas têm valor contratado, recebimento informado e comissão. Uma venda registrada NÃO confirma conciliação externa.
2. **Suporte e hospedagem** — contratos assinados, serviços separados, competências previstas, recebimentos fracionados, vencimentos e histórico imutável.
3. **Contas a pagar** — fornecedores, documentos, categoria, despesa geral ou atribuída a venda/projeto, vencimento, pagamentos parciais vinculados a débito importado.
4. **Conciliação** — arquivo UTF-8 CSV padronizado de fonte bancária, id único por conta, data, valor e tipo de lançamento; créditos vinculados 1:1 a recibos pré-existentes com valor e ID idênticos. Nenhuma importação gera receita nem altera recibo original.
5. **Devoluções** — solicitação, aprovação, baixa condicionada a débito no mesmo apelido de conta do recebimento original. Recibos originais imutáveis. Não existe funcionalidade de Pix ou transferência.
6. **Documentos fiscais** — registro de número/código/data/valor de documentos emitidos **externamente** e vinculados a venda, competência ou despesa. Cancelamento fiscal só é registrado após execução no sistema oficial. A USBRIN Partners **não emite ou cancela NFS-e**.
7. **Painel gerencial** — valores contratados, recebidos registrados, a receber, contas a pagar, custos alocados, comissões e pagamentos de desenvolvedores, mensalidades, fluxos associados a extratos importados e contribuição estimada por venda.

## Regras inegociáveis

- **Somente Admin** altera qualquer dado financeiro. Representantes e desenvolvedores não recebem rotas de acesso a extratos, despesas, estornos, conciliação ou dados fiscais.
- Cada pagamento tem **origem, data, valor, responsável, referência externa e vínculo com obrigação/documento**. Operações que não comprovem tais campos permanecem como previsão ou pendência.
- **Não apagar recibo, extrato importado, match, despesa paga ou estorno.** Correções usam lançamentos compensatórios com justificativa e auditoria, jamais alteração retroativa de um crédito.
- Sempre diferenciar **valor contratado**, **recebimento informado** e **movimentação vinculada a extrato importado**. Um CSV inserido por administrador não possui autenticação do banco e, portanto, não equivale a evidência bancária verificada independentemente.
- Os lançamentos de custo e o lucro de contribuição são **gerenciais e parciais**. Impostos, horas internas, despesas fixas e demais custos não vinculados podem alterar a margem. **Comissões ou pagamentos a desenvolvedores sinalizados como pagos em módulos legados ainda não têm conciliação independente.**
- O sistema não envia instruções de pagamento, cobra assinaturas, cria Pix, emite documentos fiscais ou transfere dinheiro.

## Integridade e acessos

- D1 **Preview**: `migrations/0013_bank_evidence_and_refunds.sql`, `0014_expense_obligations.sql`, `0015_fiscal_evidence.sql`.
- Triggers: proteção de exclusão/alteração de entradas, associações de crédito, documentos e recibos; validação de limites de estorno, de contas, competência, saldo e fontes; auditoria de criação e status.
- `/api/private/admin/bank/*` — evidências bancárias e estornos.
- `/api/private/admin/control/*` — dashboard, contas a pagar, documentação fiscal.
- Segurança: Cloudflare Access + JWT RS256 validado no servidor, checagem de origem em POST, papel ativo e auditoria. Os novos endpoints só admitem administração.
- Arquivos de extrato são aceitos em pequenos lotes com esquema rígido. Conferir no banco se a conta, período, valor e identificadores são verdadeiros antes de usar o CSV como documentação de conciliação.

## Exceções que exigem revisão manual

- Estorno parcial ou integral pode exigir **revisão de comissão, remuneração e situação do projeto**. Não reverter automaticamente comissões já pagas; abrir procedimento documentado com responsável, decisão e lançamento compensatório.
- Cancelamento ou substituição fiscal deve ser feito no emissor; o portal só pode refletir documentos externos depois da confirmação.
- Duplicidade, pagamento de origem desconhecida, diferença de valor, extrato incompleto, recebimento sem referência exata e débito não identificado devem permanecer em **pendência**.
- Contratos ou despesas incorretamente cadastrados não são apagados. Cancelar o registro somente quando não pago e justificar; depois de pago, usar o fluxo de compensação formal.

## Requisitos para liberar produção

- [ ] Contratos de desenvolvimento, hospedagem e suporte aprovados juridicamente; definição de SLA, vigência, cancelamento, titularidade do domínio e tratamento da inadimplência.
- [ ] CNPJ, regime tributário e códigos de serviço conferidos pelo contador; processo oficial de NFS-e documentado com responsabilidade definida.
- [ ] D1 de **produção separado**, migração sequencial validada e contas de teste descartadas da produção.
- [ ] Backups automatizados **fora** da conta principal, cifrados e com retenção definida; exercício de **restauração real** aprovado (não somente criação de export).
- [ ] Conciliação independente com extrato originado diretamente no banco; política de dupla checagem para estornos e alterações críticas.
- [ ] Tratamento de autenticação, proteção de dados pessoais, registros de consentimento e políticas de retenção aprovados.
- [ ] Testes com identidades reais no navegador (Admin, Representante e Desenvolvedor), dispositivo móvel real, e testes de desempenho e falhas de rede.
- [ ] Casos de sobrepagamento, cobranças duplicadas, crédito parcial, cancelamento, recuperação de dados e divergência bancária simulados.
- [ ] Rotina de fechamento mensal com aprovação e reconciliação de comissão, custos, resultados e documentos fiscais.

**Pontos ainda não implementados completamente**: API bancária somente de leitura com autenticação de proveniência, estorno efetivo com instituição financeira, conciliação de pagamentos a representantes e desenvolvedores, módulo formal de ajustes de comissão após devolução, importação automática de NFS-e, obrigações fiscais e integração contábil, backups externos agendados e teste de restauração do D1 real. Essas dependências bloqueiam a afirmação de que o financeiro está pronto para uso oficial.

## Critérios do piloto

O piloto deve usar **dados fictícios** primeiro e depois até 3–5 operações reais com supervisão humana e confirmação independente, somente após os bloqueios acima. Acompanhar taxa de conciliação, número de exceções, horas administrativas, custos, margem por contrato, estornos e atraso de cobranças. Nenhum botão deve ser considerado substituto da conferência no banco.
