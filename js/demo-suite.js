/* USBRIN Portfolio Pro — interações de Norte e Nexo.
 * Todas as operações são locais; nada é enviado, salvo ou executado remotamente.
 */
document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const api=window.USBRINSuite;if(!api)return;
  const $=selector=>document.querySelector(selector),all=selector=>[...document.querySelectorAll(selector)];
  const fmt=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n);
  const menu=$('.menu-toggle'),nav=$('#suite-nav');
  if(menu&&nav){
    const close=()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='Menu';};
    menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'Fechar':'Menu';});
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){close();menu.focus();}});
  }
  if(document.body.dataset.suite==='norte'){
    const keys={revenue:'#finance-revenue',fixed:'#finance-fixed',variable:'#finance-variable',receivable:'#finance-receivable',payable:'#finance-payable'};
    const controls=Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,$(v)]));
    const sceneButtons=all('[data-scenario]'),form=$('#finance-form');
    let label='Cenário base';
    function applyScenario(key){
      const scene=api.scenarios[key];if(!scene)return;
      label=scene.label;
      for(const field of Object.keys(keys))controls[field].value=String(scene[field]);
      sceneButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===key)));
      update();
    }
    function update(){
      const input=Object.fromEntries(Object.entries(controls).map(([key,el])=>[key,el.value.trim()===''?NaN:Number(el.value)]));
      const output=api.finance(input);
      const validation=$('#finance-validation');validation.hidden=!!output;
      $('#result-title').textContent=label;
      const fields=['#finance-result','#finance-contribution','#finance-breakeven','#finance-margin','#finance-cash','#value-revenue','#value-variable','#value-fixed'];
      if(!output){
        for(const selector of fields)$(selector).textContent='—';
        $('#finance-status').textContent='Premissas fora do intervalo permitido';
        for(const bar of ['#bar-revenue','#bar-variable','#bar-fixed'])$(bar).style.width='0%';
        return;
      }
      $('#finance-result').textContent=fmt(output.result);
      $('#finance-contribution').textContent=fmt(output.contribution);
      $('#finance-breakeven').textContent=fmt(output.breakeven);
      $('#finance-margin').textContent=(output.marginRate*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
      $('#finance-cash').textContent=fmt(output.cashGap);
      $('#finance-status').textContent=output.viable?'Resultado simplificado não negativo neste cenário':'Resultado simplificado negativo neste cenário';
      $('#value-revenue').textContent=fmt(input.revenue);
      $('#value-variable').textContent=fmt(output.variableCost);
      $('#value-fixed').textContent=fmt(input.fixed);
      const max=Math.max(1,input.revenue,input.fixed,output.variableCost)*1.08;
      for(const [sel,num] of [['#bar-revenue',input.revenue],['#bar-variable',output.variableCost],['#bar-fixed',input.fixed]])
        $(sel).style.width=Math.max(0,Math.min(100,num/max*100))+'%';
    }
    sceneButtons.forEach(button=>button.addEventListener('click',()=>applyScenario(button.dataset.scenario)));
    Object.values(controls).forEach(control=>control.addEventListener('input',()=>{
      label='Cenário personalizado';
      sceneButtons.forEach(b=>b.setAttribute('aria-pressed','false'));
      update();
    }));
    form.addEventListener('reset',e=>{e.preventDefault();applyScenario('base');});
    applyScenario('base');
  }
  if(document.body.dataset.suite==='nexo'){
    const form=$('#flow-form'),template=$('#flow-template'),channel=$('#flow-channel'),delay=$('#flow-delay');
    const priorityButtons=all('[data-priority]'),next=$('#flow-next'),restart=$('#flow-restart');
    const nodes=all('#flow-nodes li'),log=$('#flow-log');
    let priority='normal',step=0,plan=null;
    function appendLog(message){
      const li=document.createElement('li');li.textContent=message;
      if(log.children.length===1&&log.firstElementChild.textContent==='Simulação preparada. Nenhuma integração conectada.')log.replaceChildren();
      log.append(li);
    }
    function render(){
      plan=api.flow({template:template.value,channel:channel.value,priority,delay:Number(delay.value)});
      if(!plan)return;
      $('#flow-delay-value').textContent=delay.value+' min';
      $('#flow-heading').textContent=plan.name;
      $('#flow-description').textContent=plan.description;
      $('#flow-summary').textContent=plan.summary;
      for(let i=0;i<nodes.length;i++){
        const node=nodes[i],data=plan.steps[i];
        node.querySelector('.node-content strong').textContent=data.title;
        node.querySelector('.node-content small').textContent=data.note;
        node.classList.toggle('completed',i<step);
        node.classList.toggle('active',i===step&&step<plan.steps.length);
        node.querySelector('.node-status').textContent=i<step?'Executada':i===step&&step<plan.steps.length?'Próxima':'Pendente';
      }
      const ended=step>=plan.steps.length;
      next.disabled=ended;
      next.textContent=ended?'Fluxo concluído ✓':'Executar próxima etapa ↗';
      $('#flow-state').textContent=ended?'● CONCLUÍDO NA SIMULAÇÃO':step>0?'● EM EXECUÇÃO LOCAL':'● PRONTO PARA SIMULAR';
      $('#execution-fill').style.width=100*step/plan.steps.length+'%';
      $('#flow-progress').textContent=step+' de '+plan.steps.length+' etapas executadas';
    }
    function resetFlow(){step=0;log.replaceChildren();const li=document.createElement('li');li.textContent='Simulação preparada. Nenhuma integração conectada.';log.append(li);render();}
    for(const control of [template,channel,delay])control.addEventListener('input',resetFlow);
    priorityButtons.forEach(button=>button.addEventListener('click',()=>{
      priority=button.dataset.priority;priorityButtons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));resetFlow();
    }));
    next.addEventListener('click',()=>{
      if(!plan||step>=plan.steps.length)return;
      const item=plan.steps[step];
      appendLog('Etapa '+String(step+1).padStart(2,'0')+' executada localmente: '+item.title+' — '+item.note+'.');
      step++;render();
    });
    restart.addEventListener('click',resetFlow);
    form.addEventListener('reset',e=>{
      e.preventDefault();template.value='comercial';channel.value='site';delay.value='10';priority='normal';
      priorityButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.priority===priority)));
      resetFlow();
    });
    resetFlow();
  }
});
