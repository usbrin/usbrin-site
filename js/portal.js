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
   const allowed=role==='admin'?['overview','leads','applications','projects','commissions']:role==='representante'?['overview','leads','commissions']:['overview','projects','commissions'];
   document.querySelectorAll('#portal-nav button').forEach(b=>b.classList.toggle('hidden',!allowed.includes(b.dataset.view)));
   el('lead-create').classList.toggle('hidden',role!=='representante');el('goal-panel').classList.toggle('hidden',role!=='admin');
   el('project-create').classList.toggle('hidden',role!=='admin');
 };
 const open=async(name)=>{
   view=name;document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));el('view-'+name).classList.remove('hidden');
   document.querySelectorAll('#portal-nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
   el('panel-title').textContent=({overview:'Visão geral',leads:'Oportunidades',applications:'Candidaturas',projects:'Projetos',commissions:'Comissões'})[name];
   try{await load(name);message('Dados atualizados a partir do servidor.');}catch(e){message(e.message,true);}
 };
 document.querySelectorAll('#portal-nav button').forEach(x=>x.addEventListener('click',()=>open(x.dataset.view)));
 const load=async(name)=>{
   if(name==='overview'){
     const info=user.role==='admin'?await request('admin/overview'):user.role==='representante'?await request('representante/dashboard'):await request('desenvolvedor/dashboard');
     if(user.role==='admin'){const people=await request('admin/users');const target=el('goal-partner');target.replaceChildren(new Option('Selecione um representante',''));people.users.filter(x=>x.role==='representante'&&x.status==='active').forEach(x=>target.add(new Option(x.name+' — '+x.email,x.id)));}
     metrics.replaceChildren();
     if(user.role==='admin'){metric('Candidaturas recebidas',info.applications.reduce((n,x)=>n+x.total,0));metric('Parceiros ativos',info.users.reduce((n,x)=>n+(x.role==='admin'?0:x.total),0));metric('Receita recebida',currency(info.receivedCents));metric('Comissões pendentes',currency(info.commissionsPendingCents));}
     else if(user.role==='representante'){const month=new Date().toISOString().slice(0,7),goal=info.goals.find(x=>x.period===month),collected=info.sales.filter(x=>String(x.received_at).slice(0,7)===month).reduce((n,x)=>n+x.amount_cents,0);
       metric('Oportunidades',info.leads.length);metric('Vendas recebidas no mês',currency(collected));metric('Meta mensal',goal?currency(goal.goal_cents):'Não definida');metric('Progresso da meta',goal&&goal.goal_cents>0?(100*collected/goal.goal_cents).toFixed(1)+'%':'—');
       const details=el('overview-description');details.textContent='Comissões em aberto: '+currency(info.commissions.filter(x=>['estimated','approved','due'].includes(x.status)).reduce((n,x)=>n+x.amount_cents,0))+'. Comissões pagas: '+currency(info.commissions.filter(x=>x.status==='paid').reduce((n,x)=>n+x.amount_cents,0))+'.';}
     else {metric('Projetos atribuídos',info.projects.length);metric('Em desenvolvimento',info.projects.filter(x=>x.stage==='in_progress').length);metric('Para revisão',info.projects.filter(x=>x.stage==='review').length);metric('Remuneração paga',currency(info.payments.filter(x=>x.status==='paid').reduce((n,x)=>n+x.amount_cents,0)));}
     if(user.role!=='representante')el('overview-description').textContent='Esses números correspondem exclusivamente aos registros disponíveis para o seu perfil.';
   }
   if(name==='applications'&&user.role==='admin'){
     const data=await request('admin/applications');table(el('application-list'),['Protocolo','Modalidade','Nome','Cidade/UF','Status'],data.applications.map(a=>[a.protocol,a.type,a.name,a.city+'/'+a.state,a.status]),(cell,i)=>{
       const a=data.applications[i],select=node('select');['received','review','requested','interview','preapproved','documentation','approved','rejected','withdrawn'].forEach(s=>{const o=new Option(s,s);if(s===a.status)o.selected=true;select.add(o)});
       select.setAttribute('aria-label','Situação da candidatura '+a.protocol);
       const note=node('input');note.value=a.reviewer_note||'';note.placeholder='Observação interna';note.maxLength=1200;note.setAttribute('aria-label','Observação');
       cell.append(select,note,btn('Salvar',async()=>{try{await request('admin/review',{id:a.id,status:select.value,note:note.value});await open('applications')}catch(e){message(e.message,true)}}));
       if(a.status==='approved')cell.append(btn('Ativar parceiro',async()=>{
         const reference=prompt('Informe a referência do contrato já assinado e conferido:');
         if(reference===null)return;
         if(reference.trim().length<5){message('É necessária uma referência documental válida.',true);return;}
         if(!confirm('Confirma que o contrato referenciado foi assinado e conferido?'))return;
         try{await request('admin/activate',{applicationId:a.id,contractVerified:true,contractReference:reference.trim()});message('Parceiro ativado. Configure também o acesso de identidade no Cloudflare Access.');await open('applications')}catch(e){message(e.message,true)}
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
     if(user.role==='admin'){const people=await request('admin/users');const target=el('project-developer');target.replaceChildren(new Option('Selecione um desenvolvedor aprovado',''));people.users.filter(x=>x.role==='desenvolvedor'&&x.status==='active').forEach(x=>target.add(new Option(x.name+' — '+x.email,x.id)));}
     const data=user.role==='admin'?await request('admin/projects'):await request('desenvolvedor/dashboard'),projects=data.projects;
     table(el('project-list'),['Projeto','Etapa','Remuneração','Prazo','Prévia'],projects.map(x=>[x.title,x.stage,currency(x.compensation_cents),x.due_at||'-',x.preview_url||'-']),(cell,i)=>{
       const p=projects[i],allowed=user.role==='admin'?['proposed','accepted','in_progress','review','changes','approved','done','cancelled']:['accepted','in_progress','review'];
       const sel=node('select');allowed.forEach(v=>{const o=new Option(v,v);if(p.stage===v)o.selected=true;sel.add(o)});
       const url=node('input');url.placeholder='https://prévia';url.style.width='180px';cell.append(sel);
       if(user.role==='desenvolvedor')cell.append(url);
       cell.append(btn('Atualizar',async()=>{try{await request(user.role==='admin'?'admin/project-stage':'desenvolvedor/project',{id:p.id,stage:sel.value,previewUrl:url.value});await open('projects')}catch(e){message(e.message,true)}}));
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
 el('goal-form').addEventListener('submit',async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{await request('admin/goal',{partnerId:d.partnerId,period:d.period,goalCents:Math.round(Number(d.amount)*100)});message('Meta comercial atualizada.')}catch(err){message(err.message,true)}});
 el('lead-form').addEventListener('submit',async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{await request('representante/lead',{company:d.company,contact:d.contact,city:d.city,segment:d.segment,product:d.product,estimatedCents:Math.round(Number(d.estimated||0)*100),note:d.note});e.target.reset();await open('leads')}catch(err){message(err.message,true)}});
 el('project-form').addEventListener('submit',async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{await request('admin/project',{title:d.title,description:d.description,developerId:d.developerId,compensationCents:Math.round(Number(d.compensation)*100),dueAt:d.dueAt});e.target.reset();await open('projects')}catch(err){message(err.message,true)}});
 try{const res=await request('me');user=res.user;el('identity').textContent='Conta: '+user.name+' · '+user.role;setNavigation(user.role);await open('overview');}catch(e){message('Portal indisponível: '+e.message+' O acesso é liberado somente após aprovação e configuração do Cloudflare Access.',true);document.querySelectorAll('#portal-nav button').forEach(x=>x.disabled=true)}
});
