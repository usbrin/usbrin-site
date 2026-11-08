'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const el=id=>document.getElementById(id),status=el('portal-status'),metrics=el('metrics');
 let user=null,view='overview';
 const currency=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(c)||0)/100);
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n};
 const btn=(text,run)=>{const n=node('button',text,'btn');n.type='button';n.addEventListener('click',run);return n};
 const message=(text,isError=false)=>{status.textContent=text;status.className='status '+(isError?'bad':'good')};
 const request=async(path,data)=>{
   const options={credentials:'same-origin',cache:'no-store'};
   if(data!==undefined){options.method='POST';options.headers={'content-type':'application/json'};options.body=JSON.stringify(data);}
   const response=await fetch('/api/private/'+path,options);let json;try{json=await response.json()}catch{throw Error('Resposta do servidor inválida.');}
   if(!response.ok||!json.ok)throw Error(json.error||'Falha na solicitação.');
   return json;
 };
 const metric=(label,value)=>{const box=node('div',null,'metric');box.append(node('strong',value),node('span',label));metrics.append(box)};
 const table=(parent,headers,rows,actions)=>{
   parent.replaceChildren();
   if(!rows.length){parent.append(node('p','Nenhum registro disponível.','muted'));return;}
   const wrap=node('div',null,'tablewrap'),t=node('table',null,'data'),thead=node('thead'),tr=node('tr');
   headers.forEach(h=>tr.append(node('th',h)));if(actions)tr.append(node('th','Ações'));thead.append(tr);t.append(thead);
   const body=node('tbody');rows.forEach((r,i)=>{const row=node('tr');r.forEach(x=>row.append(node('td',x)));if(actions){const cell=node('td');actions(cell,i);row.append(cell)}body.append(row)});t.append(body);wrap.append(t);parent.append(wrap);
 };
 const setNavigation=role=>{
   const allowed=role==='admin'?['overview','leads','guide','applications','studio','partners','projects','commissions','billing','bank']:role==='representante'?['overview','leads','guide','commissions']:['overview','projects','commissions'];
   document.querySelectorAll('#portal-nav button').forEach(b=>b.classList.toggle('hidden',!allowed.includes(b.dataset.view)));
   el('lead-create').classList.toggle('hidden',role!=='representante');el('goal-panel').classList.add('hidden');el('action-center').classList.toggle('hidden',role!=='admin');
   el('project-create').classList.toggle('hidden',role!=='admin');
 };
 const open=async(name)=>{
   view=name;document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));el('view-'+name).classList.remove('hidden');
   el('developer-payments-admin').classList.toggle('hidden',!(name==='projects'&&user.role==='admin'));
   document.querySelectorAll('#portal-nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
   el('panel-title').textContent=({overview:'Visão geral',leads:'Oportunidades',guide:'Guia comercial',applications:'Candidaturas',studio:'Solicitações Studio',partners:'Parceiros',projects:'Projetos',commissions:'Comissões',billing:'Financeiro',bank:'Conciliação'})[name];
   try{await load(name);message('Dados atualizados a partir do servidor.');}catch(e){message(e.message,true);}
 };
 document.querySelectorAll('#portal-nav button').forEach(x=>x.addEventListener('click',()=>open(x.dataset.view)));
 const guideChecks=[...document.querySelectorAll('#sales-checklist input[type="checkbox"]')];
 const guideProgress=()=>{const checked=guideChecks.filter(x=>x.checked).length;
   el('sales-guide-progress').textContent=checked+' de '+guideChecks.length+' pontos conferidos'+(checked===guideChecks.length?'. Checklist concluído.':'.');
 };
 guideChecks.forEach(x=>x.addEventListener('change',guideProgress));
 el('lead-open-guide').addEventListener('click',()=>open('guide'));
 el('guide-goto-leads').addEventListener('click',()=>open('leads'));
 let currentGuideQuote=null;
 const guideBriefIds=new Set();
 const guideBriefLead=el('guide-brief-lead'),guideBriefForm=el('guide-brief-form'),guideBriefFeedback=el('guide-brief-feedback');
 const guideHosting=el('guide-service-hosting'),guideSupport=el('guide-service-support');
 const SUPPORT_REFERENCE_CENTS=25000; // referência comercial, não assinatura ou débito automático
 const updateServiceSummary=()=>{
   const choices=[];
   if(guideHosting.checked)choices.push('Domínio USBRIN: hospedagem gerenciada, orçamento próprio a definir');
   if(guideSupport.checked)choices.push('Suporte USBRIN: R$ 250/mês de referência, escopo e contratação separados');
   el('guide-service-summary').textContent=choices.length
     ?'Interesse registrado: '+choices.join(' · ')+'. Não somar ao preço de criação; aguardar aprovação da USBRIN.'
     :'Nenhum serviço recorrente ou de hospedagem solicitado. O valor de criação acima não muda.';
 };
 guideHosting.addEventListener('change',updateServiceSummary);
 guideSupport.addEventListener('change',updateServiceSummary);
 updateServiceSummary();
 const studioPricing=window.USBRIN_PRICING;
 const guideProduct=el('guide-estimate-product'),guidePages=el('guide-estimate-pages'),guideTotal=el('guide-estimate-total');
 const guideDescription=el('guide-estimate-description');
 const guideFeatureChecks=[...document.querySelectorAll('#guide-estimate-features input[type="checkbox"]')];
 const formatGuidePrice=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n);
 if(studioPricing&&studioPricing.PRODUCTS&&studioPricing.FEATURES){
   document.querySelectorAll('[data-guide-feature]').forEach(element=>{
     const item=studioPricing.FEATURES[element.dataset.guideFeature];
     element.textContent=item?(item.price?'+ '+formatGuidePrice(item.price):'Incluso'):'Consultar USBRIN';
   });
   el('guide-extra-page-price').textContent='+ '+formatGuidePrice(studioPricing.PAGE_PRICE)+' por página';
   document.querySelectorAll('.sales-plan').forEach((card,index)=>{
     const key=['landing','business','catalogo'][index],item=studioPricing.PRODUCTS[key];
     if(item){const label=card.querySelector('.sales-price');if(label)label.textContent='A partir de '+formatGuidePrice(item.base);}
   });
   const updateEstimate=()=>{
     const item=studioPricing.PRODUCTS[guideProduct.value];
     if(!item)return;
     guidePages.min=String(item.pages);guidePages.max=String(item.maxPages);
     guidePages.disabled=item.maxPages===item.pages;
     let pages=Number(guidePages.value);
     if(!Number.isSafeInteger(pages)||pages<item.pages||pages>item.maxPages){
       pages=item.pages;guidePages.value=String(pages);
     }
     const features=['whatsapp',...guideFeatureChecks.filter(input=>input.checked).map(input=>input.value)];
     const quote=studioPricing.calculate({product:guideProduct.value,pages,features});
     currentGuideQuote=quote;
     el('guide-brief-total').textContent=formatGuidePrice(quote.estimate);
     guideTotal.textContent=formatGuidePrice(quote.estimate);
     const extras=quote.lineItems.filter(line=>line.amount>0&&line.label!==item.label).map(line=>line.label+' ('+formatGuidePrice(line.amount)+')');
     guideDescription.textContent=extras.length
       ?'Plano '+item.label+': '+formatGuidePrice(item.base)+' + '+extras.join(' + ')+'. Estimativa sujeita à análise.'
       :'Plano '+item.label+': '+formatGuidePrice(item.base)+'. Sem adicionais pagos selecionados.';
   };
   guideProduct.addEventListener('change',()=>{
     guidePages.value=String(studioPricing.PRODUCTS[guideProduct.value].pages);updateEstimate();
   });
   guidePages.addEventListener('input',updateEstimate);
   guideFeatureChecks.forEach(input=>input.addEventListener('change',updateEstimate));
   updateEstimate();
 }else{
   guideTotal.textContent='Valores indisponíveis';
   guideDescription.textContent='A tabela de preços não foi carregada. Consulte o USBRIN Studio antes de apresentar valores.';
   guideProduct.disabled=true;guidePages.disabled=true;guideFeatureChecks.forEach(input=>input.disabled=true);
 }

 const calendarDay=(addDays=0)=>{
   const date=new Date();date.setDate(date.getDate()+addDays);
   const z=n=>String(n).padStart(2,'0');
   return date.getFullYear()+'-'+z(date.getMonth()+1)+'-'+z(date.getDate());
 };
 el('guide-brief-validity').value=calendarDay(7);
 const loadBriefLeads=async()=>{
   const data=user.role==='admin'?await request('admin/opportunities'):await request('representante/dashboard');
   const rows=(user.role==='admin'?data.opportunities:data.leads).filter(lead=>!['lost','paid','cancelled'].includes(lead.stage));
   guideBriefIds.clear();
   guideBriefLead.replaceChildren(new Option('Selecione uma oportunidade cadastrada',''));
   rows.forEach(lead=>{
     guideBriefIds.add(lead.id);
     guideBriefLead.add(new Option(lead.company+' · '+lead.contact+' · '+lead.stage,lead.id));
   });
   const empty=!rows.length;
   el('guide-brief-empty').hidden=!empty;
   el('guide-brief-submit').disabled=empty||!studioPricing;
 };
 guideBriefForm.addEventListener('submit',async event=>{
   event.preventDefault();
   if(!currentGuideQuote||!studioPricing)return message('A tabela de preços está indisponível.',true);
   if(!guideBriefIds.has(guideBriefLead.value))return message('Escolha uma oportunidade sua antes de gerar o rascunho.',true);
   const objective=el('guide-brief-objective').value.trim(),
     sections=el('guide-brief-sections').value.trim(),
     visual=el('guide-brief-visual').value.trim(),
     materials=el('guide-brief-materials').value.trim(),
     notes=el('guide-brief-notes').value.trim(),
     special=el('guide-brief-special').checked,
     duration=Number(el('guide-brief-duration').value),
     validity=el('guide-brief-validity').value;
   if(objective.length<15||sections.length<15||!Number.isSafeInteger(duration)||duration<1||duration>180||validity<calendarDay())
     return message('Preencha objetivo, conteúdo, prazo e validade corretamente.',true);
   const item=studioPricing.PRODUCTS[currentGuideQuote.product];
   const extras=currentGuideQuote.lineItems.filter(x=>x.label!==item.label);
   const scope=[
     'BRIEFING COMERCIAL USBRIN — CONFERIR ANTES DA PRODUÇÃO',
     'Plano: '+item.label,
     'Páginas: '+currentGuideQuote.pages+(currentGuideQuote.product==='landing'?' (até 6 seções)':''),
     'Adicionais solicitados: '+(extras.length?extras.map(x=>x.label).join('; '):'nenhum adicional pago'),
     'Contato por WhatsApp: incluso',
     'Objetivo e público: '+objective,
     'Páginas/seções e conteúdo: '+sections,
     'Visual e referências: '+(visual||'A definir com o cliente'),
     'Materiais entregues/pedidos: '+(materials||'A confirmar com o cliente'),
     'Outros requisitos: '+(notes||'Nenhum indicado'),
     'Domínio USBRIN / hospedagem gerenciada: '+(guideHosting.checked?'Solicitado — orçamento e condições à parte, NÃO INCLUSO no preço de criação':'Não solicitado'),
     'Suporte USBRIN mensal: '+(guideSupport.checked?'Interesse em R$ 250/mês (referência), condicionado a escopo e contratação separada; NÃO INCLUSO no preço de criação':'Não solicitado'),
     'Pagamento: somente a administração da USBRIN pode informar dados de cobrança, enviar instruções e confirmar recebimentos; o representante não recebe valores.',
     'Recurso fora do configurador: '+(special?'SIM — REVISÃO E PRECIFICAÇÃO MANUAL OBRIGATÓRIAS':'Não'),
     'Briefing sujeito a validação do escopo, prazo e condições pela administração.'
   ].join('\n');
   const terms=(special
     ?'Pré-orçamento parcial: adicionais especiais não estão incluídos no valor estimado. Exige novo preço autorizado e uma proposta substituta antes de envio ao cliente.'
     :'Valor estimado sujeito à aprovação administrativa. O envio, aceite, contratação e início do desenvolvimento dependem de formalização.')
     +' Cobrança e pagamentos: exclusivamente pela administração da USBRIN; representantes não estão autorizados a receber valores.'
     +(guideHosting.checked?' Hospedagem/domínio solicitados para orçamento separado, sem valor incluso no projeto.':'')
     +(guideSupport.checked?' Suporte mensal de R$ 250 é apenas referência preliminar e exige contratação e condições específicas, sem mensalidade automática.':'');
   const priceCents=Math.round(currentGuideQuote.estimate*100);
   if(scope.length>4000||!Number.isSafeInteger(priceCents)||priceCents<=0)return message('Revise o briefing ou os valores; o conteúdo ultrapassa o limite.',true);
   const button=el('guide-brief-submit');
   button.disabled=true;guideBriefFeedback.textContent='Registrando rascunho interno...';
   try{
     const outcome=await request('crm/proposal-draft',{
       opportunityId:guideBriefLead.value,
       product:special?'personalizado':currentGuideQuote.product,
       scope,priceCents,durationDays:duration,validUntil:validity,terms,
       hostingRequested:guideHosting.checked,supportRequested:guideSupport.checked
     });
     guideBriefFeedback.textContent='Rascunho '+outcome.code+' salvo. Abra Oportunidades → Acompanhar para consultar a proposta. A aprovação cabe à administração.';
     message('Pré-orçamento registrado, sem gerar venda nem enviar proposta ao cliente.');
   }catch(err){
     guideBriefFeedback.textContent='Não foi possível salvar: '+err.message;
     message(err.message,true);
   }finally{button.disabled=false}
 });

 for(const id of ['lead-search','lead-filter-stage','lead-filter-due'])el(id).addEventListener(id==='lead-search'?'input':'change',()=>{if(user&&view==='leads')load('leads').catch(e=>message(e.message,true))});
 for(const id of ['studio-status-filter','studio-search','app-type-filter','app-status-filter','app-search']){
   el(id).addEventListener(id==='studio-search'||id==='app-search'?'input':'change',()=>{
     const section=id.startsWith('app-')?'applications':'studio';
     if(user?.role==='admin'&&view===section)load(section).catch(e=>message(e.message,true));
   });
 }
 const renderActionCenter=tasks=>{
   const list=el('action-list');list.replaceChildren();
   const actions=[
     {name:'Candidaturas aguardando análise',count:tasks.candidates,desc:'Ver etapas de seleção',view:'applications'},
     {name:'Solicitações do Studio',count:tasks.studioNew,desc:'Avaliar novos briefings',view:'studio'},
     {name:'Projetos fora do prazo',count:tasks.overdueProjects,desc:'Revisar entregas',view:'projects'},
     {name:'Vendas com saldo a receber',count:tasks.salesAwaitingPayment,desc:'Conferir conciliação',view:'commissions'},
     {name:'Mensalidades vencidas',count:tasks.servicesOverdue,desc:'Conferir cobranças',view:'billing'},
     {name:'Mensalidades vencendo hoje',count:tasks.servicesDueToday,desc:'Ver vencimentos',view:'billing'},
     {name:'Retornos vencidos ou para hoje',count:tasks.dueFollowups,desc:'Atender contatos agendados',view:'leads'},
     {name:'Oportunidades sem atualização há 7 dias',count:tasks.dormantOpportunities,desc:'Retomar contatos',view:'leads'}
   ];
   const pending=actions.filter(a=>a.count>0);
   if(!pending.length){const empty=node('p','Nenhuma pendência registrada. Acompanhe novos candidatos, briefings e projetos por aqui.','muted');list.append(empty);return;}
   pending.forEach(a=>{
     const card=node('div',null,'task-card');
     const count=node('strong',a.count,'task-count'),description=node('span',a.name,'task-name');
     const action=btn(a.desc,()=>open(a.view));action.classList.add('task-action');
     card.append(count,description,action);list.append(card);
   });
 };
 const renderStudio=async data=>{
   const host=el('studio-list'),filter=el('studio-status-filter').value,search=el('studio-search').value.trim().toLocaleLowerCase('pt-BR');
   const items=data.inquiries.filter(x=>(!filter||x.status===filter)&&(!search||[x.name,x.company,x.protocol].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(search))));
   const people=(await request('admin/users')).users.filter(x=>x.role==='representante'&&x.status==='active');
   const nextSteps={new:['review','archived'],review:['qualified','archived'],qualified:['proposal','archived'],proposal:['closed','archived'],closed:[],archived:[]};
   table(host,['Protocolo','Contato','Tipo','Estimativa','Etapa','Recebido'],items.map(x=>[x.protocol,x.company||x.name,x.product,currency(x.estimate_cents),x.status,String(x.created_at||'').slice(0,10)]),(cell,i)=>{
     const record=items[i],details=node('details'),summary=node('summary','Ver briefing');
     const description=node('div',null,'details-content');
     description.append(node('p','Nome: '+record.name));
     if(record.email)description.append(node('p','E-mail: '+record.email));
     if(record.phone)description.append(node('p','WhatsApp: '+record.phone));
     description.append(node('p','Objetivo: '+record.goal));
     if(record.notes)description.append(node('p','Observações: '+record.notes));
     description.append(node('pre',record.briefing,'briefing-text'));
     details.append(summary,description);cell.append(details);
     const next=nextSteps[record.status]||[];
     if(next.length){
       const selection=node('select');selection.setAttribute('aria-label','Etapa da solicitação '+record.protocol);
       selection.add(new Option('Selecionar etapa',''));next.forEach(step=>selection.add(new Option(step,step)));
       const note=node('input');note.maxLength=1200;note.placeholder='Observação interna';note.value=record.reviewer_note||'';
       cell.append(selection,note,btn('Atualizar',async()=>{
         if(!selection.value){message('Selecione a próxima etapa.',true);return;}
         try{await request('admin/studio-status',{id:record.id,status:selection.value,note:note.value});await open('studio')}catch(e){message(e.message,true)}
       }));
     }
     if(record.opportunity_id){cell.append(node('p','Vinculada ao CRM','hint'));return;}
     if(!['new','review','qualified','proposal'].includes(record.status))return;
     if(!people.length){cell.append(node('p','Nenhum representante aprovado para atribuição.','hint'));return;}
     const partner=node('select');partner.setAttribute('aria-label','Atribuir representante');
     partner.add(new Option('Escolher representante',''));people.forEach(p=>partner.add(new Option(p.name,p.id)));
     cell.append(partner,btn('Criar oportunidade',async()=>{
       if(!partner.value){message('Selecione um representante.',true);return;}
       if(!confirm('Criar oportunidade vinculada a este briefing e ao representante selecionado?'))return;
       try{await request('admin/studio-assign',{inquiryId:record.id,partnerId:partner.value});await open('studio')}catch(e){message(e.message,true)}
     }));
   });
 };

 let billingAgreements=[],billingCharges=[];
 const amountCents=(value)=>{
   const raw=String(value??'').trim();
   if(!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(raw))return null;
   const [whole,decimal='']=raw.replace(',','.').split('.');
   const cents=Number(whole)*100+Number((decimal+'00').slice(0,2));
   return Number.isSafeInteger(cents)&&cents>0&&cents<=100000000?cents:null;
 };
 const isoLocal=()=>{
   const z=n=>String(n).padStart(2,'0'),d=new Date();
   return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());
 };
 const billingStatus={active:'Ativo',paused:'Pausado',cancelled:'Cancelado',pending:'Pendente',partially_paid:'Recebido parcialmente',paid:'Recebido'};
 const billingKind={support:'Suporte USBRIN',hosting:'Domínio USBRIN / hospedagem'};
 const billingCycle={monthly:'Mensal',annual:'Anual'};
 const financeCategory={
   infrastructure:'Infraestrutura',software:'Software',marketing:'Marketing',tax:'Impostos/taxas',
   contractor:'Terceirizados',office:'Administrativo',other:'Outros'
 };
 let financeExpenses=[],financeUnassignedBankDebits=[];
 const localMonth=()=>isoLocal().slice(0,7);
 el('finance-month').value=localMonth();
 const financeMetric=(target,label,value)=>{
   const card=node('div',null,'billing-stat');card.append(node('strong',value),node('span',label));target.append(card);
 };
 const loadFinanceControl=async()=>{
   const month=el('finance-month').value||localMonth();
   const [summary,detail]=await Promise.all([request('admin/control/overview?month='+encodeURIComponent(month)),request('admin/control/expenses')]);
   financeExpenses=detail.expenses;financeUnassignedBankDebits=detail.unassignedBankDebits;
   const m=el('finance-main-metrics');m.replaceChildren();
   [
     ['Vendas contratadas',currency(summary.metrics.grossContractedCents)],
     ['A receber por sites',currency(summary.metrics.siteOutstandingCents)],
     ['A receber em serviços',currency(summary.metrics.serviceOutstandingCents)],
     ['Contas a pagar',currency(summary.metrics.expensePayableCents)],
     ['Despesas vencidas',currency(summary.metrics.expenseOverdueCents)],
     ['Comissões a provisionar',currency(summary.metrics.pendingCommissionsCents)],
     ['Desenvolvedores a provisionar',currency(summary.metrics.pendingDevelopersCents)],
     ['Créditos associados a extratos',currency(summary.metrics.verifiedByImportedStatementCents)],
     ['Despesas associadas a débitos',currency(summary.metrics.matchedExpenseDebitsCents)],
     ['Devoluções associadas a débitos',currency(summary.metrics.matchedRefundDebitsCents)]
   ].forEach(([label,value])=>financeMetric(m,label,value));
   const mm=el('finance-month-metrics');mm.replaceChildren();
   [
     ['Créditos classificados no mês',currency(summary.monthly.bankMatchedInCents)],
     ['Despesas classificadas no mês',currency(summary.monthly.bankMatchedExpenseOutCents)],
     ['Devoluções classificadas no mês',currency(summary.monthly.bankMatchedRefundOutCents)],
     ['Movimento líquido classificado',currency(summary.monthly.netClassifiedCents)],
     ['Despesas em aberto com vencimento no mês',currency(summary.monthly.pendingSupplierBillsDueCents)],
     ['Serviços a receber com vencimento no mês',currency(summary.monthly.pendingServiceInvoicesDueCents)]
   ].forEach(([label,value])=>financeMetric(mm,label,value));
   table(el('finance-project-margin'),['Cliente','Valor contratado','Custos alocados','Contribuição parcial','Aviso'],
     summary.projects.map(x=>{
       const sum=x.commission_allocated_cents+x.developer_allocated_cents+x.direct_expense_cents;
       const percent=x.gross_cents>0?((x.estimatedContributionCents*100)/x.gross_cents).toFixed(1):'-';
       return [x.company,currency(x.gross_cents),currency(sum),currency(x.estimatedContributionCents)+' ('+percent+'%)','Não equivale a lucro líquido'];
     }));
   const salesSelect=el('finance-expense-sale'),oldSale=salesSelect.value;
   salesSelect.replaceChildren(new Option('Despesa geral, sem vínculo com venda',''));
   detail.eligibleSales.forEach(x=>salesSelect.add(new Option(x.company+' · '+currency(x.gross_cents),x.id)));
   if([...salesSelect.options].some(o=>o.value===oldSale))salesSelect.value=oldSale;
   table(el('finance-expense-list'),['Fornecedor','Categoria','Documento','Vencimento','Previsto','Pago com extrato','Saldo','Situação'],
     financeExpenses.map(x=>[
       x.supplier+' · '+x.label,financeCategory[x.category]||x.category,x.document_reference,x.due_on,
       currency(x.amount_cents),currency(x.paid_cents),currency(x.amount_cents-x.paid_cents),
       ({approved:'Em aberto',partially_paid:'Parcial',paid:'Pago',cancelled:'Cancelada'})[x.status]||x.status
     ]),(cell,i)=>{
       const expense=financeExpenses[i];
       const remaining=expense.amount_cents-expense.paid_cents;
       if(['approved','partially_paid'].includes(expense.status)){
         const debits=financeUnassignedBankDebits.filter(x=>-x.amount_cents<=remaining);
         if(debits.length){
           const select=node('select');select.setAttribute('aria-label','Débito bancário para '+expense.document_reference);
           select.add(new Option('Selecione débito já realizado',''));
           debits.forEach(x=>select.add(new Option(x.account_alias+' · '+x.posted_on+' · '+x.external_id+' · '+currency(x.amount_cents),x.id)));
           const settle=btn('Conciliar despesa',async()=>{
             if(!select.value)return message('Selecione o débito do extrato.',true);
             if(!confirm('Este débito foi verificado no banco e realmente corresponde à despesa? O registro ficará imutável.'))return;
             try{await request('admin/control/expense-payment',{expenseId:expense.id,bankEntryId:select.value,confirmedBankDebit:true});
               await loadFinanceControl();message('Pagamento associado ao débito importado.');}
             catch(e){message(e.message,true)}
           });
           cell.append(select,settle);
         }else cell.append(node('span','Nenhum débito de valor compatível ainda não utilizado.','muted'));
       }
       if(expense.status==='approved'&&expense.paid_cents===0){
         cell.append(btn('Cancelar obrigação',async()=>{
           const reason=prompt('Justifique o cancelamento da obrigação '+expense.document_reference+':');
           if(reason===null)return;
           if(reason.trim().length<12)return message('Informe pelo menos 12 caracteres.',true);
           if(!confirm('Cancelar apenas esta obrigação ainda não paga? O histórico permanecerá.'))return;
           try{await request('admin/control/expense-cancel',{id:expense.id,reason:reason.trim(),confirmedCancel:true});
             await loadFinanceControl();message('Obrigação cancelada com justificativa e histórico.');}
           catch(e){message(e.message,true)}
         }));
       }
     });
 };
 el('finance-month').addEventListener('change',()=>{
   if(user?.role==='admin'&&view==='billing')loadFinanceControl().catch(e=>message(e.message,true));
 });
 el('finance-expense-form').addEventListener('submit',async ev=>{
   ev.preventDefault();const form=ev.target,data=new FormData(form),amount=amountCents(data.get('amount'));
   if(!amount)return message('Informe valor válido em reais, até duas casas decimais.',true);
   if(!confirm('O documento do fornecedor foi conferido? Este registro cria obrigação, não transfere dinheiro.'))return;
   try{
     await request('admin/control/expense',{
       supplier:String(data.get('supplier')||'').trim(),label:String(data.get('label')||'').trim(),
       documentReference:String(data.get('documentReference')||'').trim(),category:data.get('category'),
       amountCents:amount,dueOn:data.get('dueOn'),saleId:data.get('saleId')||'',
       confirmedDocument:data.get('confirmedDocument')==='on'
     });
     form.reset();await loadFinanceControl();message('Obrigação registrada com documento e vencimento, sem pagamento.');
   }catch(e){message(e.message,true)}
 });
 const loadBilling=async()=>{
   await loadFinanceControl();
   const data=await request('admin/billing/overview');
   billingAgreements=data.agreements;billingCharges=data.charges;
   const m=el('billing-metrics');m.replaceChildren();
   [
     ['Contratos ativos',data.totals.agreementsActive],
     ['Saldo previsto em aberto',currency(data.totals.openCents)],
     ['Saldo vencido',currency(data.totals.overdueCents)],
     ['Total efetivamente recebido',currency(data.totals.receivedCents)]
   ].forEach(([label,value])=>{const item=node('div',null,'billing-stat');item.append(node('strong',value),node('span',label));m.append(item)});
   const saleSelect=el('billing-sale');const oldSale=saleSelect.value;
   saleSelect.replaceChildren(new Option('Selecione uma venda integralmente recebida',''));
   data.eligibleSales.forEach(x=>saleSelect.add(new Option(x.company+' · '+currency(x.gross_cents)+' recebidos',x.id)));
   if([...saleSelect.options].some(x=>x.value===oldSale))saleSelect.value=oldSale;
   el('billing-agreement-warning').textContent=data.eligibleSales.length
     ?'Somente contratos novos e documentos realmente assinados devem ser cadastrados.'
     :'Não há vendas integralmente recebidas para vincular novos contratos. O acesso não registra nenhuma transação de teste.';
   const agreementSelect=el('billing-active-agreement'),oldAgreement=agreementSelect.value;
   agreementSelect.replaceChildren(new Option('Selecione um contrato ativo',''));
   billingAgreements.filter(x=>x.status==='active').forEach(x=>
     agreementSelect.add(new Option(x.company+' · '+billingKind[x.kind]+' · '+currency(x.amount_cents)+' / '+billingCycle[x.cadence],x.id))
   );
   if([...agreementSelect.options].some(x=>x.value===oldAgreement))agreementSelect.value=oldAgreement;
   agreementSelect.dispatchEvent(new Event('change'));
   const outstanding=billingCharges.filter(x=>x.status!=='paid'),chargeSelect=el('billing-open-charge'),prior=chargeSelect.value;
   chargeSelect.replaceChildren(new Option('Selecione uma cobrança com saldo',''));
   outstanding.forEach(x=>chargeSelect.add(new Option(x.company+' · '+billingKind[x.kind]+' · competência '+x.period+' · saldo '+currency(x.amount_cents-x.received_cents),x.id)));
   if([...chargeSelect.options].some(x=>x.value===prior))chargeSelect.value=prior;
   chargeSelect.dispatchEvent(new Event('change'));
   table(el('billing-agreements'),['Cliente','Serviço','Valor por período','Vigência','Referência contratual','Status'],
     billingAgreements.map(x=>[x.company,billingKind[x.kind]+' · '+billingCycle[x.cadence],currency(x.amount_cents),x.start_on,x.contract_reference,billingStatus[x.status]||x.status]),
     (cell,i)=>{
       const a=billingAgreements[i];if(a.status==='cancelled')return;
       const opts=a.status==='active'?['paused','cancelled']:['active','cancelled'];
       opts.forEach(next=>cell.append(btn(next==='paused'?'Pausar':next==='active'?'Reativar':'Cancelar',async()=>{
         const reason=prompt('Justificativa para '+(billingStatus[next]||next)+' o serviço de '+a.company+':');
         if(reason===null)return;
         if(reason.trim().length<8)return message('Informe uma justificativa com pelo menos 8 caracteres.',true);
         if(!confirm('Confirma a alteração '+billingStatus[a.status]+' → '+billingStatus[next]+'? O histórico de cobranças permanece intacto.'))return;
         try{await request('admin/billing/agreement-status',{id:a.id,status:next,reason:reason.trim(),confirmedReview:true});await loadBilling();message('Status atualizado e auditado.');}
         catch(e){message(e.message,true)}
       })));
     });
   table(el('billing-charges'),['Cliente / serviço','Competência','Vencimento','Valor previsto','Recebido','Saldo','Situação'],
     billingCharges.map(x=>[x.company+' · '+billingKind[x.kind],x.period,x.due_on,currency(x.amount_cents),currency(x.received_cents),currency(x.amount_cents-x.received_cents),x.status==='paid'?'Recebido':x.due_on<data.today?'Vencido · '+(billingStatus[x.status]||x.status):billingStatus[x.status]||x.status]));
   table(el('billing-receipts'),['Identificador','Cobrança','Valor conciliado','Data de registro','Operador'],
     data.receipts.map(x=>[x.reference,x.charge_id,currency(x.amount_cents),x.received_at,x.actor_name||'Admin USBRIN']));
 };
 el('billing-active-agreement').addEventListener('change',()=>{
   const a=billingAgreements.find(x=>x.id===el('billing-active-agreement').value),period=el('billing-period');
   period.placeholder=a?.cadence==='annual'?'AAAA (ex.: 2027)':'AAAA-MM (ex.: 2027-01)';
   period.maxLength=a?.cadence==='annual'?4:7;
   if(a){
     const day=isoLocal();
     if(!period.value||period.value.length!==period.maxLength)period.value=day.slice(0,period.maxLength);
     if(!el('billing-charge-form').elements.dueOn.value)el('billing-charge-form').elements.dueOn.value=day;
   }
 });
 el('billing-open-charge').addEventListener('change',()=>{
   const item=billingCharges.find(x=>x.id===el('billing-open-charge').value);
   const amount=el('billing-receipt-form').elements.amount;
   amount.placeholder=item?'Saldo '+currency(item.amount_cents-item.received_cents):'Valor recebido (R$)';
   amount.max=item?String((item.amount_cents-item.received_cents)/100):'';
 });
 el('billing-agreement-form').addEventListener('submit',async e=>{
   e.preventDefault();
   const form=e.target,data=new FormData(form),amount=amountCents(data.get('amount'));
   if(!amount)return message('Informe um valor monetário válido com até duas casas decimais.',true);
   if(!confirm('O contrato de serviço realmente foi assinado e a venda foi integralmente recebida? Nenhuma cobrança será enviada.'))return;
   try{
     await request('admin/billing/agreement',{
       saleId:data.get('saleId'),kind:data.get('kind'),cadence:data.get('cadence'),amountCents:amount,
       startOn:data.get('startOn'),contractReference:data.get('contractReference'),termsSummary:data.get('termsSummary'),
       confirmedSigned:data.get('confirmedSigned')==='on'
     });
     form.reset();await loadBilling();message('Contrato registrado. Nenhuma cobrança ou receita foi criada.');
   }catch(err){message(err.message,true)}
 });
 el('billing-charge-form').addEventListener('submit',async e=>{
   e.preventDefault();
   const form=e.target,data=new FormData(form);
   if(!confirm('Confirma apenas o registro interno do vencimento? Nenhum boleto ou Pix será enviado.'))return;
   try{
     await request('admin/billing/charge',{agreementId:data.get('agreementId'),period:String(data.get('period')).trim(),dueOn:data.get('dueOn'),confirmedManual:data.get('confirmedManual')==='on'});
     form.reset();await loadBilling();message('Cobrança prevista registrada; não foi contabilizada como recebida.');
   }catch(err){message(err.message,true)}
 });
 el('billing-receipt-form').addEventListener('submit',async e=>{
   e.preventDefault();
   const form=e.target,data=new FormData(form),amount=amountCents(data.get('amount'));
   if(!amount)return message('Informe um valor monetário válido.',true);
   if(!confirm('CONFIRMAÇÃO FINANCEIRA: verificou efetivamente este crédito no extrato da USBRIN? O recibo não pode ser apagado.'))return;
   try{
     await request('admin/billing/receipt',{chargeId:data.get('chargeId'),amountCents:amount,reference:String(data.get('reference')).trim(),confirmedBank:data.get('confirmedBank')==='on'});
     form.reset();await loadBilling();message('Recebimento conciliado e preservado no histórico.');
   }catch(err){message(err.message,true)}
 });

 // Imported bank evidence never generates a payment or transfer. Reconciliation is one-to-one.
 let bankSnapshot={entries:[],matches:[],refunds:[],unmatchedReceipts:[]};
 const bankLabel={sale:'Venda de site',service:'Serviço recorrente',
   requested:'Solicitado',approved:'Aprovado, sem devolução',rejected:'Rejeitado',settled:'Devolução registrada no extrato'};
 const loadBank=async()=>{
   const info=await request('admin/bank/overview');
   bankSnapshot=info;
   const m=el('bank-metrics');m.replaceChildren();
   [
     ['Créditos no extrato',info.totals.credits_imported],
     ['Créditos associados a recibos',info.totals.matched_credits],
     ['Créditos sem associação',info.totals.unmatched_credits],
     ['Recibos sem extrato',info.totals.unmatched_sale_receipts+info.totals.unmatched_service_receipts],
     ['Devoluções em análise',info.totals.pending_refunds],
     ['Débitos de devolução conciliados',currency(info.totals.settled_refund_cents)]
   ].forEach(([label,value])=>{const item=node('div',null,'billing-stat');item.append(node('strong',value),node('span',label));m.append(item)});
   const candidateFor=entry=>info.unmatchedReceipts.filter(x=>entry.amount_cents>0&&x.amount_cents===entry.amount_cents
     &&String(x.reference).toUpperCase()===String(entry.external_id).toUpperCase());
   table(el('bank-entries'),['Data','Conta','Identificador','Descrição','Valor','Situação'],info.entries.map(e=>[
     e.posted_on,e.account_alias,e.external_id,e.description,currency(e.amount_cents),
     e.match_status==='matched-receipt'?'Associado a recibo':e.match_status==='settled-refund'?'Devolução conciliada':
       e.amount_cents>0?'Crédito não conciliado':'Débito ainda não associado'
   ]),(cell,i)=>{
     const e=info.entries[i];if(e.amount_cents<=0||e.match_status!=='unmatched')return;
     const candidates=candidateFor(e);if(!candidates.length){cell.append(node('span','Sem recibo de mesmo valor e ID bancário.','muted'));return}
     const sel=node('select');sel.setAttribute('aria-label','Recibo para '+e.external_id);
     candidates.forEach(x=>sel.add(new Option(bankLabel[x.receipt_kind]+' · '+x.company+' · '+currency(x.amount_cents),x.receipt_kind+':'+x.id)));
     cell.append(sel,btn('Conferir associação',async()=>{
       const [kind,id]=sel.value.split(':');
       if(!confirm('Você conferiu valor e identificador bancário com o recibo original? Uma associação não pode ser desfeita sem procedimento de auditoria.'))return;
       try{await request('admin/bank/match',{entryId:e.id,receiptKind:kind,receiptId:id,confirmedComparison:true});
         await loadBank();message('Recibo associado ao extrato importado.');}
       catch(err){message(err.message,true)}
     }));
   });
   table(el('bank-unmatched-receipts'),['Tipo','Cliente','Referência','Valor','Registro'],info.unmatchedReceipts.map(x=>[
     bankLabel[x.receipt_kind],x.company,x.reference,currency(x.amount_cents),x.received_at
   ]));
   table(el('bank-imports'),['Conta','Arquivo','Linhas','SHA256 (início)','Importado em'],info.batches.map(x=>[
     x.account_alias,x.filename,x.row_count,x.sha_prefix,x.created_at
   ]));
   const select=el('bank-refund-receipt'),previous=select.value;
   select.replaceChildren(new Option('Selecione um recibo associado ao extrato',''));
   info.matches.forEach(x=>select.add(new Option(bankLabel[x.receipt_kind]+' · '+x.external_id+' · '+currency(x.amount_cents),x.receipt_kind+':'+x.receipt_id)));
   if([...select.options].some(o=>o.value===previous))select.value=previous;
   table(el('bank-refunds'),['Referência original','Valor','Justificativa','Estado'],info.refunds.map(x=>[
     x.original_reference,currency(x.amount_cents),x.reason,bankLabel[x.status]||x.status
   ]),(cell,i)=>{
     const item=info.refunds[i];
     if(item.status==='requested'){
       cell.append(btn('Aprovar análise',async()=>{
         if(!confirm('A aprovação exige que o recibo original esteja associado ao extrato. Confirma a análise do caso, sem transferir dinheiro?'))return;
         try{await request('admin/bank/refund-review',{id:item.id,decision:'approved',confirmedReview:true});
           await loadBank();message('Devolução aprovada para execução externa, sem transferência feita.');}
         catch(err){message(err.message,true)}
       }));
     }
     if(['requested','approved'].includes(item.status)){
       cell.append(btn('Rejeitar pedido',async()=>{
         if(!confirm('Confirma a rejeição da devolução? O histórico será preservado.'))return;
         try{await request('admin/bank/refund-review',{id:item.id,decision:'rejected',confirmedReview:true});
           await loadBank();message('Solicitação rejeitada com histórico preservado.');}
         catch(err){message(err.message,true)}
       }));
     }
     if(item.status==='approved'){
       const source=info.matches.find(x=>x.receipt_kind===item.receipt_kind&&x.receipt_id===item.receipt_id);
       const debitCandidates=info.entries.filter(x=>x.amount_cents===-item.amount_cents&&x.match_status==='unmatched'&&x.account_alias===source?.account_alias);
       if(debitCandidates.length){
         const sel=node('select');sel.setAttribute('aria-label','Débito bancário para a devolução '+item.original_reference);
         debitCandidates.forEach(e=>sel.add(new Option(e.posted_on+' · '+e.external_id+' · '+currency(e.amount_cents),e.id)));
         cell.append(sel,btn('Conciliar débito já efetuado',async()=>{
           if(!confirm('ATENÇÃO: você verificou no banco o débito efetivo desta devolução? O sistema não executa pagamento. A liquidação é irreversível.'))return;
           try{await request('admin/bank/refund-settle',{id:item.id,bankEntryId:sel.value,confirmedBankDebit:true});
             await loadBank();message('Devolução associada ao débito no extrato importado.');}
           catch(err){message(err.message,true)}
         }));
       }else cell.append(node('span','Aguardando débito correspondente no extrato.','muted'));
     }
   });
 };
 el('bank-import-form').addEventListener('submit',async ev=>{
   ev.preventDefault();
   const form=ev.target,params=new FormData(form),file=el('bank-import-file').files?.[0];
   if(!file||file.size<25||file.size>110000)return message('Selecione um CSV UTF-8 de até 110 KB.',true);
   if(!/\.csv$/i.test(file.name))return message('Somente extrato CSV com cabeçalho padronizado.',true);
   const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
   el('bank-import-feedback').textContent='Lendo extrato para conferência...';
   try{
     const csv=await file.text();
     if(!confirm('Confirma que este CSV foi obtido diretamente do banco e corresponde à conta identificada? Nenhum pagamento será criado.'))return;
     const out=await request('admin/bank/import',{accountAlias:params.get('accountAlias'),filename:file.name,
       csv,confirmedSource:params.get('confirmedSource')==='on'});
     form.reset();
     el('bank-import-feedback').textContent='Lote registrado: '+out.rows+' transações ('+out.credits+' créditos, '+out.debits+' débitos).';
     await loadBank();message('Extrato importado; associações ainda precisam de conferência.');
   }catch(e){el('bank-import-feedback').textContent='Falha ao importar: '+e.message;message(e.message,true)}
   finally{submit.disabled=false}
 });
 el('bank-refund-form').addEventListener('submit',async ev=>{
   ev.preventDefault();const form=ev.target,data=new FormData(form),[kind,id]=String(data.get('source')||'').split(':'),
     amount=amountCents(data.get('amount'));
   if(!amount||!id)return message('Escolha um recibo e valor de devolução válidos.',true);
   if(!confirm('Registrar apenas pedido de devolução interna, sem executar Pix, TED ou outra transferência?'))return;
   try{
     await request('admin/bank/refund-request',{receiptKind:kind,receiptId:id,amountCents:amount,
       reason:String(data.get('reason')||'').trim(),confirmedCase:data.get('confirmedCase')==='on'});
     form.reset();await loadBank();message('Pedido de devolução registrado; nenhum dinheiro foi movimentado.');
   }catch(e){message(e.message,true)}
 });

 const load=async(name)=>{
   if(name==='bank'&&user.role==='admin')await loadBank();
   if(name==='billing'&&user.role==='admin')await loadBilling();
   if(name==='guide'&&(user.role==='admin'||user.role==='representante'))await loadBriefLeads();
   if(name==='overview'){
     const info=user.role==='admin'?await request('admin/overview'):user.role==='representante'?await request('representante/dashboard'):await request('desenvolvedor/dashboard');
     if(user.role==='admin'){const people=await request('admin/users');const reps=people.users.filter(x=>x.role==='representante'&&x.status==='active');const target=el('goal-partner');target.replaceChildren(new Option('Selecione um representante',''));reps.forEach(x=>target.add(new Option(x.name+' — '+x.email,x.id)));el('goal-panel').classList.toggle('hidden',reps.length===0);renderActionCenter(info.tasks||{});}
     metrics.replaceChildren();
     if(user.role==='admin'){metric('Candidaturas recebidas',info.applications.reduce((n,x)=>n+x.total,0));metric('Parceiros ativos',info.users.reduce((n,x)=>n+(x.role==='admin'?0:x.total),0));metric('Receita recebida',currency(info.receivedCents));metric('Comissões pendentes',currency(info.commissionsPendingCents));}
     else if(user.role==='representante'){const month=new Date().toISOString().slice(0,7),goal=info.goals.find(x=>x.period===month),collected=info.sales.filter(x=>String(x.received_at).slice(0,7)===month).reduce((n,x)=>n+x.amount_cents,0);
       metric('Oportunidades',info.leads.length);metric('Vendas recebidas no mês',currency(collected));metric('Meta mensal',goal?currency(goal.goal_cents):'Não definida');metric('Progresso da meta',goal&&goal.goal_cents>0?(100*collected/goal.goal_cents).toFixed(1)+'%':'—');
       const details=el('overview-description');details.textContent='Comissões em aberto: '+currency(info.commissions.filter(x=>['estimated','approved','due'].includes(x.status)).reduce((n,x)=>n+x.amount_cents,0))+'. Comissões pagas: '+currency(info.commissions.filter(x=>x.status==='paid').reduce((n,x)=>n+x.amount_cents,0))+'.';}
     else {metric('Projetos atribuídos',info.projects.length);metric('Em desenvolvimento',info.projects.filter(x=>x.stage==='in_progress').length);metric('Para revisão',info.projects.filter(x=>x.stage==='review').length);metric('Remuneração paga',currency(info.payments.filter(x=>x.status==='paid').reduce((n,x)=>n+x.amount_cents,0)));}
     if(user.role!=='representante')el('overview-description').textContent='Esses números correspondem exclusivamente aos registros disponíveis para o seu perfil.';
   }
   if(name==='studio'&&user.role==='admin'){const entries=await request('admin/studio-inquiries');await renderStudio(entries);}
   if(name==='partners'&&user.role==='admin'){
     const people=(await request('admin/users')).users.filter(x=>['representante','desenvolvedor'].includes(x.role));
     table(el('partner-list'),['Profissional','E-mail','Papel','Acesso','Contrato verificado'],
       people.map(x=>[x.name,x.email,x.role==='representante'?'Comercial':'Desenvolvimento',x.status,x.contract_ready?'Sim':'Não']),
       (cell,i)=>{
         const partner=people[i],next=partner.status==='active'?'suspended':partner.status==='suspended'?'active':null;
         if(!next)return;
         const reason=node('input');reason.maxLength=500;reason.placeholder='Justificativa obrigatória';reason.setAttribute('aria-label','Justificativa para alterar acesso de '+partner.name);
         const action=btn(next==='suspended'?'Suspender acesso':'Reativar acesso',async()=>{
           if(reason.value.trim().length<8){message('Informe uma justificativa com pelo menos 8 caracteres.',true);return;}
           if(next==='active'&&!partner.contract_ready){message('A reativação exige contrato assinado e verificado.',true);return;}
           const warning=next==='suspended'&&!partner.contract_ready?
             '\n\nATENÇÃO: esta conta não tem contrato verificado; após a suspensão, a interface não permitirá reativá-la. Contas de homologação exigem restauração administrativa controlada.':'';
           if(!confirm((next==='suspended'?'Bloquear o acesso às APIs de ':'Reativar o acesso às APIs de ')+partner.name+'?'+warning))return;
           try{
             await request('admin/partner-access',{userId:partner.id,status:next,reason:reason.value.trim()});
             await open('partners');
             message(next==='suspended'?'Acesso bloqueado no servidor. Confirme também a política Cloudflare Access.':'Acesso reativado no servidor. Confirme a autorização de identidade no Cloudflare Access.');
           }catch(e){message(e.message,true)}
         });
         action.disabled=next==='active'&&!partner.contract_ready;
         cell.append(reason,action);
         if(next==='active'&&!partner.contract_ready)cell.append(node('p','Reativação bloqueada: documentação não verificada.','hint'));
         if(next==='suspended'&&!partner.contract_ready)cell.append(node('p','Conta sem contrato verificado: a suspensão não poderá ser revertida por esta tela.','hint'));
       });
   }
   if(name==='applications'&&user.role==='admin'){
     const data=await request('admin/applications');
     const type=el('app-type-filter').value,statusFilter=el('app-status-filter').value,search=el('app-search').value.trim().toLocaleLowerCase('pt-BR');
     const applicants=data.applications.filter(x=>
       (!type||x.type===type)&&(!statusFilter||x.status===statusFilter)&&
       (!search||[x.name,x.email,x.protocol,x.city].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(search)))
     );
     const statuses={received:'Recebida',review:'Em análise',requested:'Informações solicitadas',interview:'Entrevista',preapproved:'Pré-aprovada',documentation:'Documentação',approved:'Aprovada',rejected:'Não selecionada',withdrawn:'Encerrada'};
     const transitions={received:['review','rejected','withdrawn'],review:['requested','interview','preapproved','rejected','withdrawn'],requested:['review','rejected','withdrawn'],interview:['preapproved','rejected','withdrawn'],preapproved:['documentation','rejected','withdrawn'],documentation:['approved','rejected','withdrawn'],approved:[],rejected:[],withdrawn:[]};
     table(el('application-list'),['Protocolo','Modalidade','Candidato','Cidade/UF','Etapa'],applicants.map(x=>[
       x.protocol,x.type==='representante'?'Comercial':'Desenvolvimento',x.name,x.city+'/'+x.state,statuses[x.status]||x.status
     ]),(cell,i)=>{
       const a=applicants[i];
       const details=node('details'),summary=node('summary','Ver candidatura');
       const content=node('div',null,'details-content');
       content.append(node('p','Nome: '+a.name),node('p','E-mail: '+a.email),node('p','WhatsApp: '+a.phone));
       content.append(node('p','Disponibilidade: '+(a.availability||'Não informada')));
       content.append(node('p','Experiência:'),node('pre',a.experience,'briefing-text'));
       content.append(node('p','Apresentação:'),node('pre',a.motivation,'briefing-text'));
       if(a.portfolio){
         try{const url=new URL(a.portfolio);
           if(url.protocol==='https:'){
             const link=node('a','Ver portfólio');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';content.append(link);
           }
         }catch{}
       }
       details.append(summary,content);
       cell.append(details);
       const note=node('input');note.value=a.reviewer_note||'';note.placeholder='Nota interna da avaliação';note.maxLength=1200;note.setAttribute('aria-label','Nota interna de '+a.protocol);
       cell.append(note,btn('Salvar observação',async()=>{
         try{await request('admin/application-note',{id:a.id,note:note.value});message('Observação interna salva.')}catch(e){message(e.message,true)}
       }));
       const choices=transitions[a.status]||[];
       if(choices.length){
         const select=node('select');select.setAttribute('aria-label','Próxima etapa de '+a.protocol);select.add(new Option('Próxima etapa',''));
         choices.forEach(v=>select.add(new Option(statuses[v]||v,v)));
         cell.append(select,btn('Atualizar etapa',async()=>{
           if(!select.value){message('Escolha uma etapa para avançar.',true);return;}
           if(!confirm('Confirmar mudança na etapa de seleção? Esta ação não envia notificações automáticas.'))return;
           try{await request('admin/review',{id:a.id,status:select.value,note:note.value});await open('applications')}catch(e){message(e.message,true)}
         }));
       }
       if(a.status==='approved')cell.append(btn('Ativar parceiro',async()=>{
         const reference=prompt('Informe a referência do contrato já assinado e conferido:');
         if(reference===null)return;
         if(reference.trim().length<5){message('É necessária uma referência documental válida.',true);return;}
         if(!confirm('Confirma que o contrato referenciado foi assinado e conferido?'))return;
         try{await request('admin/activate',{applicationId:a.id,contractVerified:true,contractReference:reference.trim()});await open('applications')}catch(e){message(e.message,true)}
       }));
     });
   }
   if(name==='leads'){
     const data=user.role==='admin'?await request('admin/opportunities'):await request('representante/dashboard');
     const leads=user.role==='admin'?data.opportunities:data.leads;
     const today=(()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())})();
     const isClosed=x=>['lost','paid','cancelled'].includes(x.stage);
     const due=leads.filter(x=>x.next_action_at&&!isClosed(x)&&x.next_action_at<=today);
     const noDate=leads.filter(x=>!x.next_action_at&&!isClosed(x));
     const sum=el('crm-summary');sum.replaceChildren();
     [
       ['Oportunidades',leads.length],['Retornos vencidos / hoje',due.length],
       ['Sem próximo contato',noDate.length],['Em negociação',leads.filter(x=>['proposal','negotiation'].includes(x.stage)).length]
     ].forEach(([label,value])=>{const item=node('div',null,'crm-stat');item.append(node('strong',value),node('span',label));sum.append(item)});
     const search=el('lead-search').value.trim().toLocaleLowerCase('pt-BR'),
       stageFilter=el('lead-filter-stage').value,dueFilter=el('lead-filter-due').value;
     const filtered=leads.filter(x=>
       (!stageFilter||x.stage===stageFilter)&&
       (!search||[x.company,x.contact,x.segment,x.product].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(search)))&&
       (!dueFilter||(dueFilter==='due'&&x.next_action_at&&x.next_action_at<=today&&!isClosed(x))||(dueFilter==='no-date'&&!x.next_action_at&&!isClosed(x)))
     );
     const loadHistory=async(host,id)=>{
       const result=await request('crm/history?id='+encodeURIComponent(id));
       host.replaceChildren();
       if(!result.activities.length){host.append(node('p','Nenhum contato ou observação registrado.','muted'));return;}
       result.activities.forEach(item=>{
         const row=node('p',null,'crm-history-item');
         row.append(node('strong',item.actor_name||'Usuário'),node('span',' · '+item.kind+' · '+String(item.created_at||'').slice(0,16)),node('span',item.note));
         host.append(row);
       });
     };
     table(el('lead-list'),['Empresa','Contato','Serviço','Valor estimado','Etapa','Próximo contato'],filtered.map(x=>[
       x.company,x.contact,x.product||'-',currency(x.estimated_cents),x.stage,
       x.next_action_at?(x.next_action_at<=today&&!isClosed(x)?'Vencido/hoje: ':'')+x.next_action_at+' · '+(x.next_action||'Ação não definida'):'Não agendado'
     ]),(cell,i)=>{
       const x=filtered[i],details=node('details',null,'crm-details'),summary=node('summary','Acompanhar');
       const form=node('div',null,'crm-action-grid'),activity=node('textarea');
       activity.placeholder='Registre a conversa com o cliente ou uma observação interna';activity.maxLength=1200;activity.rows=3;
       const history=node('div',null,'crm-history');
       const addActivity=kind=>btn(kind==='contact'?'Registrar contato':'Adicionar observação',async()=>{
         if(activity.value.trim().length<3){message('Descreva o contato ou a observação.',true);return;}
         try{await request('crm/activity',{opportunityId:x.id,kind,note:activity.value.trim()});activity.value='';await loadHistory(history,x.id);message('Histórico atualizado.');}
         catch(e){message(e.message,true)}
       });
       form.append(activity,addActivity('contact'),addActivity('note'));
       if(!isClosed(x)){
         const action=node('input');action.value=x.next_action||'';action.maxLength=160;action.placeholder='Próxima ação (ex.: enviar proposta)';
         const day=node('input');day.type='date';day.value=x.next_action_at||'';day.setAttribute('aria-label','Data do próximo retorno');
         const save=btn('Salvar retorno',async()=>{
           try{await request('crm/followup',{opportunityId:x.id,action:action.value.trim(),date:day.value});await open('leads');message('Próximo contato agendado.');}
           catch(e){message(e.message,true)}
         });
         form.append(node('strong','Próximo acompanhamento','crm-label'),action,day,save);
       }
       if(user.role==='representante'&&!['contracted','paid','cancelled','lost'].includes(x.stage)){
         const stageSelect=node('select');
         for(const v of ['new','contact','interested','qualified','proposal','negotiation','lost'])stageSelect.add(new Option(v,v));
         stageSelect.value=x.stage;
         const reason=node('textarea');reason.rows=2;reason.maxLength=350;reason.placeholder='Por que esta oportunidade foi perdida?';reason.hidden=true;
         stageSelect.addEventListener('change',()=>reason.hidden=stageSelect.value!=='lost');
         form.append(node('strong','Etapa comercial','crm-label'),stageSelect,reason,btn('Atualizar etapa',async()=>{
           if(stageSelect.value===x.stage)return message('Escolha uma nova etapa.',true);
           if(stageSelect.value==='lost'&&reason.value.trim().length<5)return message('Informe o motivo da perda.',true);
           try{await request('representante/lead-stage',{id:x.id,stage:stageSelect.value,lostReason:reason.value.trim()});await open('leads');}
           catch(e){message(e.message,true)}
         }));
       }
       if(user.role==='admin'&&!['lost','paid','contracted','cancelled'].includes(x.stage)){
         const gross=node('input');gross.type='number';gross.min='0';gross.step='.01';gross.placeholder='Contrato (R$)';
         const paid=node('input');paid.type='number';paid.min='0';paid.step='.01';paid.placeholder='Recebido (R$)';
         const reference=node('input');reference.maxLength=120;reference.placeholder='Referência de recebimento (se houver)';
         const sell=btn('Registrar contrato / recebimento',async()=>{
           const g=Math.round(Number(gross.value)*100),p=Math.round(Number(paid.value)*100);
           if(!Number.isSafeInteger(g)||g<=0||!Number.isSafeInteger(p)||p<0||p>g)return message('Confira os valores informados.',true);
           if(p>0&&reference.value.trim().length<3)return message('Informe a referência bancária conciliada.',true);
           if(!confirm('Confirma o contrato e que qualquer recebimento informado foi conciliado de verdade?'))return;
           try{await request('admin/sale',{opportunityId:x.id,grossCents:g,receivedCents:p,reference:reference.value});await open('leads');}
           catch(e){message(e.message,true)}
         });
         form.append(node('strong','Formalização pela administração','crm-label'),gross,paid,reference,sell);
       }
       const proposalsArea=node('div',null,'crm-proposals');
       const refreshProposals=async()=>{
         proposalsArea.replaceChildren();
         const list=(await request('crm/proposals?id='+encodeURIComponent(x.id))).proposals;
         if(!list.length){proposalsArea.append(node('p','Nenhuma proposta preparada para este cliente.','muted'));return;}
         list.forEach(p=>{
           const card=node('div',null,'crm-proposal-card');
           card.append(node('strong',p.code+' · '+currency(p.price_cents)+' · '+p.status),
             node('p','Criação: '+p.product+' · Prazo: '+p.duration_days+' dias · Válida até '+p.valid_until),
             node('p',p.scope.slice(0,160)+(p.scope.length>160?'…':'')));
           if(p.hosting_requested||p.support_requested){
             const opt=[];
             if(p.hosting_requested)opt.push('Domínio/Hospedagem USBRIN: solicitado, preço à parte');
             if(p.support_requested)opt.push('Suporte USBRIN: R$ 250/mês de referência; contratação separada');
             card.append(node('p',opt.join(' · '),'muted'));
           }
           if(user.role==='admin'&&p.status==='draft'){
             const costs=node('div',null,'crm-proposal-costs');
             const inputs=[
               ['developerCents','Produção técnica (R$)'],['commissionCents','Comissões (R$)'],
               ['taxCents','Tributos estimados (R$)'],['otherCents','Outros custos (R$)']
             ];
             const fields={};
             inputs.forEach(([key,title])=>{
               const inp=node('input');inp.type='number';inp.min='0';inp.step='.01';inp.placeholder=title;inp.setAttribute('aria-label',title);
               inp.required=true;fields[key]=inp;costs.append(inp);
             });
             const note=node('textarea');note.maxLength=1000;note.rows=2;note.placeholder='Observação interna da aprovação ou motivo da recusa';
             const decision=async(status)=>{
               if(status==='rejected'&&note.value.trim().length<8)return message('Informe o motivo da recusa.',true);
               const payload={id:p.id,decision:status,note:note.value.trim()};
               if(status==='approved'){
                 for(const [key] of inputs){
                   const v=fields[key].value.trim();
                   if(v===''||!Number.isFinite(Number(v))||Number(v)<0)return message('Preencha todos os custos estimados, inclusive quando forem zero.',true);
                   payload[key]=Math.round(Number(v)*100);
                 }
                 const total=inputs.reduce((n,[key])=>n+payload[key],0);
                 if(total>p.price_cents)return message('Os custos previstos ultrapassam o preço da proposta.',true);
                 if(!confirm('Confirma a revisão do escopo, preço, prazo, tributos, comissão e margem? A aprovação não envia a proposta.'))return;
               }else if(!confirm('Devolver esta proposta com a justificativa informada?'))return;
               try{await request('admin/proposal-review',payload);await refreshProposals();message(status==='approved'?'Proposta aprovada para emissão.':'Rascunho devolvido.');}
               catch(e){message(e.message,true)}
             };
             costs.append(note,btn('Aprovar proposta',()=>decision('approved')),btn('Devolver rascunho',()=>decision('rejected')));
             card.append(node('p','Revisão financeira interna — não aparece na via do cliente.','muted'),costs);
           }
           if(['approved','sent'].includes(p.status)){
             const link=node('a','Abrir proposta para PDF','btn');link.href='proposta.html?o='+encodeURIComponent(x.id)+'&p='+encodeURIComponent(p.id);
             link.target='_blank';link.rel='noopener noreferrer';card.append(link);
             if(user.role==='admin'){
               const total=(p.cost_dev_cents||0)+(p.cost_commission_cents||0)+(p.cost_tax_cents||0)+(p.cost_other_cents||0);
               card.append(node('p','Margem estimada: '+currency(p.price_cents-total)+' · '+((p.price_cents-total)*100/p.price_cents).toFixed(1)+'%','muted'));
               if(p.status==='approved'){
                 card.append(btn('Marcar como enviada',async()=>{
                   if(!confirm('Confirma que a proposta foi enviada ao cliente por um canal externo?'))return;
                   try{await request('admin/proposal-mark-sent',{id:p.id,confirmedExternally:true});await refreshProposals();message('Envio registrado, sem criar venda.');}
                   catch(e){message(e.message,true)}
                 }));
               }
             }
           }
           proposalsArea.append(card);
         });
       };
       if(!isClosed(x)){
         const quoteDetails=node('details',null,'crm-new-proposal');
         quoteDetails.append(node('summary','Preparar rascunho de proposta'));
         const draft=node('div',null,'crm-action-grid'),
           product=node('select'),scope=node('textarea'),price=node('input'),days=node('input'),until=node('input'),terms=node('textarea');
         for(const [code,label] of [['landing','Landing'],['business','Business'],['catalogo','Catálogo'],['personalizado','Personalizado']])product.add(new Option(label,code));
         const selected=String(x.product||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
         product.value=selected.includes('catalogo')?'catalogo':selected.includes('business')?'business':selected.includes('landing')?'landing':'personalizado';
         scope.placeholder='Escopo específico: páginas, seções, integrações, conteúdo, revisões, itens não incluídos e entregáveis';scope.maxLength=4000;scope.rows=5;
         price.type='number';price.min='0.01';price.step='.01';price.placeholder='Valor da proposta (R$)';price.value=x.estimated_cents>0?String(x.estimated_cents/100):'';
         days.type='number';days.min='1';days.max='180';days.step='1';days.value='14';days.setAttribute('aria-label','Prazo estimado em dias');
         until.type='date';until.setAttribute('aria-label','Validade da proposta');
         const expiry=new Date();expiry.setDate(expiry.getDate()+7);
         const pad=n=>String(n).padStart(2,'0');
         until.value=expiry.getFullYear()+'-'+pad(expiry.getMonth()+1)+'-'+pad(expiry.getDate());
         terms.rows=2;terms.maxLength=500;terms.placeholder='Condições e premissas comerciais; a aprovação final cabe à USBRIN';
         draft.append(node('p','Apenas rascunho interno. Não envia mensagem, não confirma contrato nem registra receita. Pagamento e cobrança são realizados exclusivamente pela USBRIN.','muted'),product,scope,price,days,until);
         if(user.role==='admin')draft.append(terms);
         draft.append(btn('Salvar rascunho',async()=>{
           const cents=Math.round(Number(price.value)*100),duration=Number(days.value);
           if(scope.value.trim().length<30||!Number.isSafeInteger(cents)||cents<1||!Number.isSafeInteger(duration)||duration<1||duration>180||!until.value)
             return message('Preencha escopo detalhado, preço, prazo e validade.',true);
           try{
             await request('crm/proposal-draft',{opportunityId:x.id,product:product.value,scope:scope.value.trim(),priceCents:cents,durationDays:duration,validUntil:until.value,terms:terms.value.trim()});
             await refreshProposals();quoteDetails.open=false;message('Rascunho criado. Aguarda aprovação administrativa.');
           }catch(e){message(e.message,true)}
         }));
         quoteDetails.append(draft);form.append(quoteDetails);
       }
       details.addEventListener('toggle',()=>{if(details.open){
         loadHistory(history,x.id).catch(e=>{history.replaceChildren(node('p',e.message,'error'))});
         refreshProposals().catch(e=>{proposalsArea.replaceChildren(node('p',e.message,'error'))});
       }});
       details.append(summary,form,node('strong','Propostas comerciais','crm-label'),proposalsArea,node('strong','Histórico de acompanhamento','crm-label'),history);cell.append(details);
     });
   }
   if(name==='projects'){
     if(user.role==='admin'){
       const [people,availableSales]=await Promise.all([request('admin/users'),request('admin/sales')]);
       const target=el('project-developer');
       target.replaceChildren(new Option('Selecione um desenvolvedor aprovado',''));
       people.users.filter(x=>x.role==='desenvolvedor'&&x.status==='active').forEach(x=>target.add(new Option(x.name+' — '+x.email,x.id)));
       const salesSelect=el('project-sale');salesSelect.replaceChildren(new Option('Projeto avulso — sem venda vinculada',''));
       const salesById=new Map(availableSales.sales.map(x=>[x.id,x]));
       availableSales.sales.forEach(x=>salesSelect.add(new Option(x.company+' · contrato '+currency(x.gross_cents)+' · recebido '+currency(x.received_cents)+(x.approved_proposal_code?' · '+x.approved_proposal_code:''),x.id)));
       salesSelect.onchange=()=>{
         const selected=salesById.get(salesSelect.value),scope=el('project-form').elements.description;
         const proposed=el('project-proposal-id'),briefStatus=el('project-brief-status');
         proposed.value='';
         scope.readOnly=false;
         if(!selected){
           scope.value='';briefStatus.textContent='Projeto avulso: descreva manualmente os requisitos de desenvolvimento.';
           return;
         }
         const title=el('project-form').elements.title;
         if(!title.value.trim()||title.value.startsWith('Site — '))title.value='Site — '+selected.company;
         if(selected.approved_proposal_id&&selected.approved_scope){
           proposed.value=selected.approved_proposal_id;
           scope.value=selected.approved_scope;
           scope.readOnly=true;
           briefStatus.textContent='Escopo importado da proposta aprovada '+selected.approved_proposal_code+'. O desenvolvedor recebe exatamente esse briefing ao ser atribuído. Para alterar o conteúdo, revise a proposta e o contrato.';
         }else{
           scope.value='';
           briefStatus.textContent='Esta venda não tem proposta aprovada vinculada. Informe um briefing técnico manual e confira o escopo contratado antes de criar o projeto.';
         }
       };
     }
     const data=user.role==='admin'?await request('admin/projects'):await request('desenvolvedor/dashboard'),projects=data.projects;
     table(el('project-list'),['Projeto','Cliente','Etapa','Remuneração','Prazo','Prévia'],projects.map(x=>[x.title,x.client_company||'Avulso',x.stage,currency(x.compensation_cents),x.due_at||'-',x.preview_url||'-']),(cell,i)=>{
       const p=projects[i],allowed=user.role==='admin'?['proposed','accepted','in_progress','review','changes','approved','done','cancelled']:['accepted','in_progress','review'];
       const sel=node('select');allowed.forEach(v=>{const o=new Option(v,v);if(p.stage===v)o.selected=true;sel.add(o)});
       const url=node('input');url.placeholder='https://prévia';url.style.width='180px';cell.append(sel);
       if(p.description){
         const brief=node('details',null,'project-approved-brief');
         brief.append(node('summary',p.proposal_id?'Ver escopo da proposta aprovada':'Ver escopo técnico'),node('pre',p.description,'project-scope'));
         cell.append(brief);
       }
       if(user.role==='desenvolvedor')cell.append(url);
       cell.append(btn('Atualizar',async()=>{try{await request(user.role==='admin'?'admin/project-stage':'desenvolvedor/project',{id:p.id,stage:sel.value,previewUrl:url.value});await open('projects')}catch(e){message(e.message,true)}}));
     });
   }
   if(name==='projects'&&user.role==='admin'){
     const payments=await request('admin/developer-payments');
     const projects=await request('admin/projects');
     const select=el('developer-payment-project');
     select.replaceChildren(new Option('Selecione um projeto aprovado',''));
     projects.projects.filter(p=>['approved','done'].includes(p.stage)).forEach(p=>select.add(new Option(p.title+' — previsto '+currency(p.compensation_cents),p.id)));
     table(el('developer-payment-list'),['Projeto','Desenvolvedor','Valor','Situação'],payments.payments.map(p=>[p.title,p.developer,currency(p.amount_cents),p.status]),(cell,i)=>{
       const p=payments.payments[i],next={pending:'approved',approved:'paid'}[p.status];
       if(next)cell.append(btn('Marcar '+next,async()=>{
         let reference='';
         if(next==='paid'){
           const raw=prompt('Informe a referência bancária do pagamento realizado:');
           if(raw===null)return;reference=raw.trim();
           if(reference.length<3){message('Referência bancária obrigatória.',true);return;}
         }
         if(!confirm('Confirmar atualização deste pagamento?'))return;
         try{await request('admin/developer-payment-status',{id:p.id,status:next,reference});await open('projects')}catch(e){message(e.message,true);}
       }));
     });
   }
   if(name==='commissions'){
     const target=el('commission-list');
     if(user.role==='representante'){
       const d=await request('representante/dashboard');table(target,['Venda','Base','Taxa','Comissão','Status'],d.commissions.map(c=>[c.sale_id,currency(c.basis_cents),(c.rate_bps/100).toFixed(2)+'%',currency(c.amount_cents),c.status]));
     }else if(user.role==='admin'){
       const d=await request('admin/finance');
       table(target,['Venda','Parceiro','Comissão','Status'],d.commissions.map(c=>[c.sale_id,c.partner_name,currency(c.amount_cents),c.status]),(cell,i)=>{
         const c=d.commissions[i],next={estimated:'approved',approved:'due',due:'paid'}[c.status];if(next)cell.append(btn('Marcar '+next,async()=>{let reference='';if(next==='paid'){const input=prompt('Referência do pagamento efetuado (obrigatória):');if(input===null)return;reference=input.trim();if(reference.length<3){message('Informe uma referência financeira válida.',true);return;}}if(!confirm('Confirma a atualização financeira?'))return;try{await request('admin/commission-status',{id:c.id,status:next,reference});await open('commissions')}catch(e){message(e.message,true)}}));
       });
       const box=node('div',null,'panel');box.append(node('h3','Registrar comissão de venda recebida'));
       const select=node('select');d.sales.forEach(s=>select.add(new Option(s.company+' — '+currency(s.received_cents),s.id)));
       const rate=node('input');rate.type='number';rate.min='0';rate.max='50';rate.step='.01';rate.placeholder='Percentual aprovado (%)';
       box.append(select,rate,btn('Calcular e registrar',async()=>{if(!confirm('Percentual confirmado conforme contrato do parceiro?'))return;try{await request('admin/commission',{saleId:select.value,rateBps:Math.round(Number(rate.value)*100)});await open('commissions')}catch(e){message(e.message,true)}}));target.prepend(box);
       const receipts=node('div',null,'panel');receipts.append(node('h3','Lançar parcela recebida'));
       const saleChoice=node('select');const eligible=d.receivableSales||[];
       saleChoice.add(new Option('Selecione uma venda com saldo',''));eligible.forEach(x=>saleChoice.add(new Option(x.company+' — saldo '+currency(x.gross_cents-x.received_cents),x.id)));
       const amount=node('input');amount.type='number';amount.min='0.01';amount.step='.01';amount.placeholder='Parcela (R$)';
       const reference=node('input');reference.placeholder='Referência da transação';
       receipts.append(saleChoice,amount,reference,btn('Registrar parcela',async()=>{if(!saleChoice.value)return message('Selecione uma venda.',true);if(!confirm('Parcela conciliada com recebimento financeiro real?'))return;try{await request('admin/sale-receipt',{saleId:saleChoice.value,amountCents:Math.round(Number(amount.value)*100),reference:reference.value});await open('commissions')}catch(e){message(e.message,true)}}));target.prepend(receipts);

     }else {const data=await request('desenvolvedor/dashboard');table(target,['Projeto','Valor','Situação','Pagamento'],data.payments.map(x=>[x.project_id,currency(x.amount_cents),x.status,x.paid_at||'Pendente']));}
   }
 };
 el('developer-payment-form').addEventListener('submit',async(e)=>{
   e.preventDefault();
   const d=Object.fromEntries(new FormData(e.target));
   if(!confirm('Valor confirmado para o projeto aprovado?'))return;
   try{
     await request('admin/developer-payment',{projectId:d.projectId,amountCents:Math.round(Number(d.amount)*100),status:'pending'});
     e.target.reset();await open('projects');
   }catch(err){message(err.message,true)}
 });
 el('goal-form').addEventListener('submit',async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{await request('admin/goal',{partnerId:d.partnerId,period:d.period,goalCents:Math.round(Number(d.amount)*100)});message('Meta comercial atualizada.')}catch(err){message(err.message,true)}});
 el('lead-form').addEventListener('submit',async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{await request('representante/lead',{company:d.company,contact:d.contact,city:d.city,segment:d.segment,product:d.product,estimatedCents:Math.round(Number(d.estimated||0)*100),note:d.note,nextAction:d.nextAction||'',nextActionAt:d.nextActionAt||''});e.target.reset();await open('leads')}catch(err){message(err.message,true)}});
 el('project-form').addEventListener('submit',async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{await request('admin/project',{title:d.title,description:d.description,developerId:d.developerId,compensationCents:Math.round(Number(d.compensation)*100),dueAt:d.dueAt,saleId:d.saleId||'',proposalId:d.proposalId||''});e.target.reset();await open('projects')}catch(err){message(err.message,true)}});
 try{const res=await request('me');user=res.user;el('identity').textContent='Conta: '+user.name+' · '+user.role;setNavigation(user.role);await open('overview');}catch(e){message('Portal indisponível: '+e.message+' O acesso é liberado somente após aprovação e configuração do Cloudflare Access.',true);document.querySelectorAll('#portal-nav button').forEach(x=>x.disabled=true)}
});
