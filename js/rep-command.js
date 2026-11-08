'use strict';
// USBRIN Command: isolated, role-specific presentation for representative accounts.
// All customer data comes from server-authorized endpoints. No payment actions exist here.
(()=>{
  const STAGES={new:'Novo',contact:'Contato iniciado',interested:'Interessado',
    qualified:'Qualificado',proposal:'Proposta',negotiation:'Negociação',
    contracted:'Contratado',paid:'Recebido',lost:'Perdido',cancelled:'Cancelado'};
  const ACTIVE=new Set(['new','contact','interested','qualified','proposal','negotiation','contracted']);
  const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(c||0)/100);
  const percent=n=>Math.round(Number(n||0)*15/100);
  const node=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};
  const dayISO=()=>{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Porto_Velho',year:'numeric',month:'2-digit',day:'2-digit'})
      .formatToParts(new Date());
    const map=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    return map.year+'-'+map.month+'-'+map.day;
  };
  const dateText=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return 'Sem data';const [y,m,d]=s.split('-');return d+'/'+m+'/'+y;};
  const heading=(h,s)=>{
    const b=node('div','cmd-heading'),title=node('h3',null,h);
    b.append(title);if(s)b.append(node('p','cmd-muted',s));return b;
  };
  const actionButton=(label,onClick,cls='cmd-button')=>{
    const b=node('button',cls,label);b.type='button';b.addEventListener('click',onClick);return b;
  };
  const safeStage=stage=>STAGES[stage]||'Em acompanhamento';
  const priorities=(leads,latest,today)=>leads.filter(x=>ACTIVE.has(x.stage)).map(x=>{
    const p=latest.get(x.id);
    const date=x.next_action_at||null,stamp=String(x.updated_at||x.created_at||'').slice(0,10);
    const daysOld=stamp?Math.floor((Date.parse(today+'T12:00:00Z')-Date.parse(stamp+'T12:00:00Z'))/86400000):0;
    let rank=5,why='Próximo contato programado';
    if(date&&date<today){rank=0;why='Retorno atrasado desde '+dateText(date)}
    else if(date===today){rank=1;why='Retorno programado para hoje'}
    else if(p?.status==='sent'&&p.valid_until<today){rank=2;why='Proposta enviada já ultrapassou a validade'}
    else if(p?.status==='sent'&&!date){rank=2;why='Proposta enviada sem retorno agendado'}
    else if(daysOld>=7&&!date){rank=3;why='Sem atualização há pelo menos 7 dias'}
    else if(!date){rank=4;why='Oportunidade sem próximo passo registrado'}
    return {...x,rank,why,proposal:p};
  }).sort((a,b)=>a.rank-b.rank||(a.next_action_at||'9999').localeCompare(b.next_action_at||'9999')
    ||String(a.company).localeCompare(String(b.company),'pt-BR'));
  const render=({root,data,user,openLead,openStage,openSection,request,refresh,notify})=>{
    if(!root||!data||user?.role!=='representante')return;
    const today=dayISO(),leads=Array.isArray(data.leads)?data.leads:[],
      proposals=Array.isArray(data.proposals)?data.proposals:[],
      commissions=Array.isArray(data.commissions)?data.commissions:[],
      contracts=Array.isArray(data.contracts)?data.contracts:[];
    const latest=new Map();
    for(const p of proposals)if(!latest.has(p.opportunity_id))latest.set(p.opportunity_id,p);
    const queue=priorities(leads,latest,today),next=queue[0]||null;
    const openLeads=leads.filter(x=>ACTIVE.has(x.stage));
    const activeProposals=[...latest.values()].filter(x=>['draft','approved','sent'].includes(x.status));
    const commissionPotential=openLeads.reduce((n,x)=>n+percent(
      ['draft','approved','sent'].includes(latest.get(x.id)?.status)
        ?latest.get(x.id).price_cents:(x.estimated_cents||0)),0);
    const pending=commissions.filter(x=>['estimated','approved'].includes(x.status)).reduce((n,x)=>n+x.amount_cents,0);
    const due=commissions.filter(x=>x.status==='due').reduce((n,x)=>n+x.amount_cents,0);
    const paid=commissions.filter(x=>x.status==='paid').reduce((n,x)=>n+x.amount_cents,0);
    const contracted=contracts.filter(x=>['pending','partially_paid','paid'].includes(x.status));
    const greetingHour=Number(new Intl.DateTimeFormat('en-US',{hour:'2-digit',hour12:false,timeZone:'America/Porto_Velho'}).format(new Date()));
    const greeting=greetingHour<12?'Bom dia':greetingHour<18?'Boa tarde':'Boa noite';
    root.innerHTML=`<div class="cmd-hero">
      <div class="cmd-hero-top"><span class="cmd-eyebrow">USBRIN PARTNERS <span aria-hidden="true">/</span> COMMAND</span><span class="cmd-today" id="cmd-day"></span></div>
      <h2 id="cmd-greeting"></h2>
      <p class="cmd-hero-sub" id="cmd-sub"></p>
      <div class="cmd-hero-cta"><button type="button" id="cmd-new">+ Nova oportunidade</button><button type="button" id="cmd-guide">Consultar guia comercial</button></div>
    </div>
    <div class="cmd-lead-grid">
      <section class="cmd-priority cmd-card" aria-labelledby="cmd-priority-title">
        <div class="cmd-block-label"><span class="cmd-signal" aria-hidden="true"></span> SUA PRÓXIMA AÇÃO</div>
        <h3 id="cmd-priority-title"></h3><p id="cmd-priority-why" class="cmd-muted"></p>
        <div id="cmd-priority-meta" class="cmd-priority-meta"></div><div id="cmd-priority-actions" class="cmd-buttons"></div>
        <div id="cmd-quick-action" class="cmd-quick-action" hidden></div>
      </section>
      <aside class="cmd-overview" aria-label="Indicadores comerciais">
        <div class="cmd-mini"><span>Retornos atrasados ou hoje</span><strong id="cmd-kpi-due"></strong><small>Acompanhamentos que exigem ação</small></div>
        <div class="cmd-mini"><span>Propostas em andamento</span><strong id="cmd-kpi-proposals"></strong><small>Rascunho, aprovada ou enviada</small></div>
        <div class="cmd-mini cmd-mini-accent"><span>Comissão potencial</span><strong id="cmd-kpi-potential"></strong><small>Simulação sobre negócios em aberto, não é renda devida</small></div>
        <div class="cmd-mini"><span>Comissão liberada</span><strong id="cmd-kpi-due-money"></strong><small>Conforme aprovação e contrato</small></div>
      </aside>
    </div>
    <div class="cmd-work-grid">
      <section class="cmd-card cmd-daycard" aria-labelledby="cmd-day-title">
        <div class="cmd-section-top"><div><span class="cmd-eyebrow">ROTINA COMERCIAL</span><h3 id="cmd-day-title">Meu Dia</h3><p class="cmd-muted">Prioridades reais, na ordem em que merecem atenção.</p></div><span class="cmd-count" id="cmd-count-day"></span></div>
        <div id="cmd-agenda" class="cmd-agenda"></div>
        <div class="cmd-inline-footer"><button id="cmd-all-leads" type="button">Abrir minha carteira <span aria-hidden="true">↗</span></button></div>
      </section>
      <aside class="cmd-side">
        <section class="cmd-card" aria-labelledby="cmd-clients-title">
          <div class="cmd-section-top"><div><span class="cmd-eyebrow">OPORTUNIDADES</span><h3 id="cmd-clients-title">Clientes prioritários</h3></div></div>
          <div id="cmd-clients" class="cmd-clients"></div>
        </section>
        <section class="cmd-card cmd-shortcuts" aria-labelledby="cmd-shortcuts-title">
          <h3 id="cmd-shortcuts-title">Acesso rápido</h3><div class="cmd-shortcut-buttons">
            <button id="cmd-shortcut-new" type="button">Novo cliente <span aria-hidden="true">↗</span></button>
            <button id="cmd-shortcut-brief" type="button">Preparar briefing <span aria-hidden="true">↗</span></button>
            <button id="cmd-shortcut-guide" type="button">Guia comercial <span aria-hidden="true">↗</span></button>
            <button id="cmd-shortcut-comm" type="button">Comissões <span aria-hidden="true">↗</span></button>
          </div>
        </section>
      </aside>
    </div>
    <section class="cmd-card cmd-pipeline" aria-labelledby="cmd-pipeline-title">
      <div class="cmd-section-top"><div><span class="cmd-eyebrow">MINHA CARTEIRA</span><h3 id="cmd-pipeline-title">O caminho das oportunidades</h3><p class="cmd-muted">Selecione uma etapa para abrir os respectivos clientes.</p></div><span id="cmd-active-count" class="cmd-count"></span></div>
      <div id="cmd-funnel" class="cmd-funnel"></div><div id="cmd-alerts" class="cmd-alerts"></div>
    </section>
    <div class="cmd-bottom-grid">
      <section class="cmd-card" aria-labelledby="cmd-proposals-title">
        <div class="cmd-section-top"><div><span class="cmd-eyebrow">NEGOCIAÇÃO</span><h3 id="cmd-proposals-title">Propostas em andamento</h3></div><button id="cmd-all-proposals" type="button" class="cmd-link">Ver oportunidades</button></div>
        <div id="cmd-proposal-list" class="cmd-proposal-list"></div>
      </section>
      <section class="cmd-card cmd-results" aria-labelledby="cmd-results-title">
        <div class="cmd-section-top"><div><span class="cmd-eyebrow">MEUS RESULTADOS</span><h3 id="cmd-results-title">Comissões · 15%</h3></div><button id="cmd-all-comm" type="button" class="cmd-link">Ver histórico</button></div>
        <div class="cmd-results-stats"><div><span>Apuradas / em aprovação</span><strong id="cmd-comm-pending"></strong></div><div><span>Liberadas</span><strong id="cmd-comm-due"></strong></div><div><span>Registradas como pagas</span><strong id="cmd-comm-paid"></strong></div></div>
        <p class="cmd-muted cmd-commission-note">15% do valor final da criação do site, após recebimento integral e conforme contrato. Suporte e hospedagem não são somados. Nenhuma proposta equivale a comissão liberada.</p>
      </section>
    </div>
    <p class="cmd-data-footnote" id="cmd-data-note"></p>`;
    const $=id=>root.querySelector('#'+id);
    $('cmd-day').textContent=dateText(today);
    const first=String(user.name||'Representante').trim().split(/\s+/)[0];
    $('cmd-greeting').textContent=greeting+', '+first+'. Sua operação começa aqui.';
    $('cmd-sub').textContent=queue.length
      ?queue.filter(x=>x.rank<=1).length+' acompanhamento(s) para hoje ou atrasados. Foque no próximo passo de cada cliente.'
      :'Sua agenda está organizada. Registre uma oportunidade ou prepare o próximo contato.';
    $('cmd-kpi-due').textContent=queue.filter(x=>x.rank<=1).length;
    $('cmd-kpi-proposals').textContent=activeProposals.length;
    $('cmd-kpi-potential').textContent=money(commissionPotential);
    $('cmd-kpi-due-money').textContent=money(due);
    $('cmd-comm-pending').textContent=money(pending);
    $('cmd-comm-due').textContent=money(due);
    $('cmd-comm-paid').textContent=money(paid);
    $('cmd-count-day').textContent=queue.length?queue.length+' em aberto':'Em dia';
    $('cmd-active-count').textContent=openLeads.length+' em acompanhamento';
    $('cmd-data-note').textContent=(data.leadsTruncated?'Sua carteira ultrapassa 200 registros. As listas e estimativas exibem apenas os 200 registros mais recentes. ':'')
      +'Valores comerciais e comissões são exibidos conforme os dados cadastrados, não constituindo extrato bancário.';
    $('cmd-new').onclick=()=>openSection('leads',true);
    $('cmd-guide').onclick=()=>openSection('guide');
    $('cmd-shortcut-new').onclick=()=>openSection('leads',true);
    $('cmd-shortcut-brief').onclick=()=>openSection('guide');
    $('cmd-shortcut-guide').onclick=()=>openSection('guide');
    $('cmd-shortcut-comm').onclick=()=>openSection('commissions');
    $('cmd-all-leads').onclick=()=>openSection('leads');
    $('cmd-all-proposals').onclick=()=>openSection('leads');
    $('cmd-all-comm').onclick=()=>openSection('commissions');
    if(next){
      $('cmd-priority-title').textContent=next.company;
      $('cmd-priority-why').textContent=next.why;
      const meta=$('cmd-priority-meta');
      [safeStage(next.stage),next.next_action||'Definir próximo passo',next.next_action_at?dateText(next.next_action_at):'Sem data'].forEach(x=>meta.append(node('span',null,x)));
      const action=$('cmd-priority-actions');
      action.append(actionButton('Abrir oportunidade',()=>openLead(next.id),'cmd-button cmd-button-primary'));
      const actionPanel=$('cmd-quick-action');
      const toggle=(mode)=>{
        actionPanel.hidden=false;actionPanel.replaceChildren();
        const label=node('label','cmd-form-label',mode==='followup'?'Próxima ação comercial':'Resumo da interação');
        const input=mode==='followup'?node('input','cmd-form-field'):node('textarea','cmd-form-field');
        if(mode==='followup'){input.type='text';input.maxLength=160;input.value=next.next_action||'';input.placeholder='Ex.: apresentar proposta e alinhar valores';}
        else{input.rows=3;input.maxLength=1200;input.placeholder='Registre o que foi conversado, sem informações sensíveis';}
        label.append(input);
        const controls=node('div','cmd-form-controls');
        let date;
        if(mode==='followup'){
          date=node('input','cmd-form-field');date.type='date';date.value=next.next_action_at||today;
          date.setAttribute('aria-label','Data do próximo retorno');
          controls.append(date);
        }
        const save=actionButton('Salvar',async()=>{
          const value=input.value.trim();
          if(value.length<3||mode==='followup'&&!date.value)return notify('Preencha os campos com uma ação ou observação válida.',true);
          save.disabled=true;
          try{
            await request(mode==='followup'?'crm/followup':'crm/activity',
              mode==='followup'?{opportunityId:next.id,action:value,date:date.value}:{opportunityId:next.id,kind:'contact',note:value});
            notify('Registro salvo na oportunidade.');await refresh();
          }catch(e){notify(e.message,true);save.disabled=false}
        },'cmd-button cmd-button-primary');
        controls.append(save,actionButton('Cancelar',()=>{actionPanel.hidden=true;actionPanel.replaceChildren()},'cmd-button'));
        actionPanel.append(label,controls);input.focus();
      };
      action.append(actionButton('Registrar contato',()=>toggle('contact')));
      action.append(actionButton('Agendar retorno',()=>toggle('followup')));
    }else{
      $('cmd-priority-title').textContent='Nenhuma oportunidade precisa de ação agora.';
      $('cmd-priority-why').textContent='Comece identificando um potencial cliente. A agenda será organizada com base nos retornos registrados.';
      $('cmd-priority-actions').append(actionButton('Adicionar oportunidade',()=>openSection('leads',true),'cmd-button cmd-button-primary'));
    }
    const agenda=$('cmd-agenda');
    if(!queue.length)agenda.append(node('p','cmd-empty','Sem contatos pendentes. Cadastre seu primeiro lead ou agende um próximo retorno.'));
    queue.slice(0,6).forEach((x,i)=>{
      const row=node('button','cmd-agenda-row');row.type='button';row.addEventListener('click',()=>openLead(x.id));
      row.append(node('span','cmd-queue-number',String(i+1)));
      const copy=node('span','cmd-agenda-copy');copy.append(node('strong',null,x.company),node('small',null,x.next_action||x.why));row.append(copy);
      row.append(node('span',x.rank<=1?'cmd-due-urgent':'cmd-due-date',x.next_action_at?dateText(x.next_action_at):'Definir ação'));
      agenda.append(row);
    });
    const clients=$('cmd-clients');
    const focus=[...queue].sort((a,b)=>
      Number(['proposal','negotiation'].includes(b.stage))-Number(['proposal','negotiation'].includes(a.stage))
      ||a.rank-b.rank).slice(0,3);
    if(!focus.length)clients.append(node('p','cmd-empty','As negociações prioritárias aparecerão aqui assim que você cadastrar clientes.'));
    focus.forEach(x=>{
      const b=node('button','cmd-client-card');b.type='button';b.addEventListener('click',()=>openLead(x.id));
      const top=node('span','cmd-client-top');top.append(node('strong',null,x.company),node('small',null,safeStage(x.stage)));b.append(top);
      b.append(node('span','cmd-client-bottom',x.why));clients.append(b);
    });
    const funnel=$('cmd-funnel');
    const groups=[
      {name:'Novos',stages:['new']},
      {name:'Em contato',stages:['contact','interested']},
      {name:'Qualificados',stages:['qualified']},
      {name:'Propostas',stages:['proposal']},
      {name:'Negociação',stages:['negotiation']},
      {name:'Contratos',stages:['contracted','paid']}
    ];
    const max=Math.max(1,...groups.map(g=>leads.filter(x=>g.stages.includes(x.stage)).length));
    groups.forEach(g=>{
      const count=leads.filter(x=>g.stages.includes(x.stage)).length;
      const b=node('button','cmd-funnel-step');b.type='button';b.disabled=count===0;
      b.addEventListener('click',()=>openStage(g.stages));
      const first=node('span','cmd-funnel-main');first.append(node('strong',null,g.name),node('b',null,count));b.append(first);
      const track=node('span','cmd-bar'),fill=node('span','cmd-bar-fill');
      fill.style.width=(count/max*100)+'%';track.append(fill);b.append(track);funnel.append(b);
    });
    const alertBox=$('cmd-alerts'),alerts=[];
    const expired=[...latest.values()].filter(p=>p.status==='sent'&&p.valid_until<today&&openLeads.some(x=>x.id===p.opportunity_id));
    if(expired.length)alerts.push(expired.length+' proposta(s) enviada(s) com validade vencida — revisar antes de renovar');
    const missing=openLeads.filter(x=>!x.next_action_at);
    if(missing.length)alerts.push(missing.length+' oportunidade(s) sem retorno agendado');
    const duplicateMap=new Map();
    for(const x of openLeads){const key=String(x.company||'').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
      if(key)duplicateMap.set(key,(duplicateMap.get(key)||0)+1);}
    const repeated=[...duplicateMap.values()].filter(v=>v>1).length;
    if(repeated)alerts.push(repeated+' nome(s) de empresa repetido(s) na sua própria carteira — verificar duplicidade');
    if(alerts.length)alerts.forEach(x=>alertBox.append(node('p',null,x)));
    else alertBox.append(node('p','cmd-muted','Nenhum alerta de duplicidade ou proposta expirada identificado na carteira carregada.'));
    const proposalHost=$('cmd-proposal-list');
    const active=activeProposals.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,4);
    if(!active.length)proposalHost.append(node('p','cmd-empty','Nenhuma proposta em andamento. Prepare o briefing após conhecer a necessidade do cliente.'));
    const byId=new Map(leads.map(x=>[x.id,x]));
    for(const p of active){
      const b=node('button','cmd-proposal-row');b.type='button';b.addEventListener('click',()=>openLead(p.opportunity_id));
      const line=node('span','cmd-proposal-top');
      line.append(node('strong',null,byId.get(p.opportunity_id)?.company||'Oportunidade'),node('b',null,money(p.price_cents)));
      const statusLabel={draft:'Em análise',approved:'Aprovada pela USBRIN',sent:'Enviada ao cliente',rejected:'Revisão solicitada'};
      b.append(line,node('small',null,(statusLabel[p.status]||p.status)+' · válida até '+dateText(p.valid_until)));
      proposalHost.append(b);
    }
    if(contracted.length&&activeProposals.length===0)$('cmd-data-note').textContent+=' Negócios contratados aparecem no CRM, não como propostas pendentes.';
  };
  window.USBRIN_REP_COMMAND={render,dayISO,percent};
})();
