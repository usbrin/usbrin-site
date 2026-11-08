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
   const allowed=role==='admin'?['overview','leads','applications','studio','partners','projects','commissions']:role==='representante'?['overview','leads','commissions']:['overview','projects','commissions'];
   document.querySelectorAll('#portal-nav button').forEach(b=>b.classList.toggle('hidden',!allowed.includes(b.dataset.view)));
   el('lead-create').classList.toggle('hidden',role!=='representante');el('goal-panel').classList.add('hidden');el('action-center').classList.toggle('hidden',role!=='admin');
   el('project-create').classList.toggle('hidden',role!=='admin');
 };
 const open=async(name)=>{
   view=name;document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));el('view-'+name).classList.remove('hidden');
   el('developer-payments-admin').classList.toggle('hidden',!(name==='projects'&&user.role==='admin'));
   document.querySelectorAll('#portal-nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
   el('panel-title').textContent=({overview:'Visão geral',leads:'Oportunidades',applications:'Candidaturas',studio:'Solicitações Studio',partners:'Parceiros',projects:'Projetos',commissions:'Comissões'})[name];
   try{await load(name);message('Dados atualizados a partir do servidor.');}catch(e){message(e.message,true);}
 };
 document.querySelectorAll('#portal-nav button').forEach(x=>x.addEventListener('click',()=>open(x.dataset.view)));
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
 const load=async(name)=>{
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
     table(el('lead-list'),['Empresa','Contato','Serviço','Valor estimado','Etapa'],leads.map(x=>[x.company,x.contact,x.product||'-',currency(x.estimated_cents),x.stage]),user.role==='representante'?(cell,i)=>{
       const x=leads[i],s=node('select');['new','contact','interested','qualified','proposal','negotiation','lost'].forEach(v=>{const o=new Option(v,v);if(x.stage===v)o.selected=true;s.add(o)});
       cell.append(s,btn('Atualizar',async()=>{try{await request('representante/lead-stage',{id:x.id,stage:s.value});await open('leads')}catch(e){message(e.message,true)}}));
     }:(cell,i)=>{
       const x=leads[i],gross=node('input');gross.type='number';gross.min='0';gross.step='.01';gross.placeholder='Contrato (BRL)';gross.style.width='120px';
       const paid=node('input');paid.type='number';paid.min='0';paid.step='.01';paid.placeholder='Recebido (BRL)';paid.style.width='120px';
       const reference=node('input');reference.placeholder='Referência bancária';reference.maxLength=120;reference.style.width='155px';
       cell.append(gross,paid,reference,btn('Registrar venda',async()=>{
         if(!confirm('Confirma o valor contratado e o recebimento conciliado?'))return;
         try{
           const g=Math.round(Number(gross.value)*100),p=Math.round(Number(paid.value)*100);
           await request('admin/sale',{opportunityId:x.id,grossCents:g,receivedCents:p,reference:reference.value});
           await open('leads');
         }catch(e){message(e.message,true);}
       }));

     });
   }
   if(name==='projects'){
     if(user.role==='admin'){
       const [people,availableSales]=await Promise.all([request('admin/users'),request('admin/sales')]);
       const target=el('project-developer');
       target.replaceChildren(new Option('Selecione um desenvolvedor aprovado',''));
       people.users.filter(x=>x.role==='desenvolvedor'&&x.status==='active').forEach(x=>target.add(new Option(x.name+' — '+x.email,x.id)));
       const salesSelect=el('project-sale');salesSelect.replaceChildren(new Option('Projeto avulso — sem venda vinculada',''));
       availableSales.sales.forEach(x=>salesSelect.add(new Option(x.company+' · contrato '+currency(x.gross_cents)+' · recebido '+currency(x.received_cents),x.id)));
     }
     const data=user.role==='admin'?await request('admin/projects'):await request('desenvolvedor/dashboard'),projects=data.projects;
     table(el('project-list'),['Projeto','Cliente','Etapa','Remuneração','Prazo','Prévia'],projects.map(x=>[x.title,x.client_company||'Avulso',x.stage,currency(x.compensation_cents),x.due_at||'-',x.preview_url||'-']),(cell,i)=>{
       const p=projects[i],allowed=user.role==='admin'?['proposed','accepted','in_progress','review','changes','approved','done','cancelled']:['accepted','in_progress','review'];
       const sel=node('select');allowed.forEach(v=>{const o=new Option(v,v);if(p.stage===v)o.selected=true;sel.add(o)});
       const url=node('input');url.placeholder='https://prévia';url.style.width='180px';cell.append(sel);
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
 el('lead-form').addEventListener('submit',async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{await request('representante/lead',{company:d.company,contact:d.contact,city:d.city,segment:d.segment,product:d.product,estimatedCents:Math.round(Number(d.estimated||0)*100),note:d.note});e.target.reset();await open('leads')}catch(err){message(err.message,true)}});
 el('project-form').addEventListener('submit',async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{await request('admin/project',{title:d.title,description:d.description,developerId:d.developerId,compensationCents:Math.round(Number(d.compensation)*100),dueAt:d.dueAt,saleId:d.saleId||''});e.target.reset();await open('projects')}catch(err){message(err.message,true)}});
 try{const res=await request('me');user=res.user;el('identity').textContent='Conta: '+user.name+' · '+user.role;setNavigation(user.role);await open('overview');}catch(e){message('Portal indisponível: '+e.message+' O acesso é liberado somente após aprovação e configuração do Cloudflare Access.',true);document.querySelectorAll('#portal-nav button').forEach(x=>x.disabled=true)}
});
