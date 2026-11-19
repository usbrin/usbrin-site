'use strict';
/* Salão Orla — conceitos ilustrativos, estado em memória, nenhuma API, cadastro ou agenda. */
(function(){
const services=Object.freeze({
 corte:{name:'Corte autoral',minutes:60},
 escova:{name:'Escova & movimento',minutes:45},
 cor:{name:'Cor personalizada',minutes:120},
 luzes:{name:'Luzes naturais',minutes:150},
 ritual:{name:'Ritual de hidratação',minutes:50},
 spa:{name:'Spa capilar',minutes:75}
});
const MAX=3;
const styleLabels={natural:'Natural e leve',moderno:'Moderno e marcante',classico:'Clássico e delicado'};
const periodLabels={sem:'A definir',manha:'Manhã',tarde:'Tarde',noite:'Fim de tarde / noite'};
function totalMinutes(ids){return ids.reduce((sum,id)=>sum+services[id].minutes,0);}
function createBrief(ids,style,period){
 if(!ids.length)throw new Error('Selecione pelo menos um serviço.');
 if(ids.length>MAX||new Set(ids).size!==ids.length||ids.some(id=>!Object.hasOwn(services,id)))throw new RangeError('Seleção inválida.');
 if(!Object.hasOwn(styleLabels,style)||!Object.hasOwn(periodLabels,period))throw new RangeError('Preferência inválida.');
 return ['SALÃO ORLA — BRIEFING ILUSTRATIVO (NÃO É AGENDAMENTO)',
 'Serviços de referência: '+ids.map(id=>services[id].name).join(', '),
 'Estilo desejado: '+styleLabels[style],
 'Período preferido: '+periodLabels[period],
 'Duração didática somada: '+totalMinutes(ids)+' minutos',
 'Projeto autoral USBRIN. Sem agenda, profissionais ou atendimento real.'].join('\n');
}
if(typeof module!=='undefined'&&module.exports)module.exports={services,MAX,totalMinutes,createBrief};
if(typeof document==='undefined')return;
document.addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id);
 const selected=[];
 const chips=[...document.querySelectorAll('button[data-filter]')];
 const cards=[...document.querySelectorAll('.service-card[data-category]')];
 const buttons=[...document.querySelectorAll('button[data-select]')];
 let category='todos';
 const status=$('orla-status');
 const notify=text=>{status.textContent=text;};
 const redraw=()=>{
  $('orla-selected').replaceChildren();
  if(!selected.length){const p=document.createElement('p');p.textContent='Você ainda não selecionou serviços. Escolha até três opções no menu acima.';$('orla-selected').append(p);}
  else selected.forEach(id=>{
   const div=document.createElement('div');div.className='selected-item';
   const title=document.createElement('span');title.textContent=services[id].name;
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.setAttribute('aria-label','Remover '+services[id].name);
   remove.addEventListener('click',()=>{const i=selected.indexOf(id);if(i>=0)selected.splice(i,1);redraw();notify('Serviço removido da seleção ilustrativa.');});
   div.append(title,remove);$('orla-selected').append(div);
  });
  $('orla-count').textContent=selected.length+' / '+MAX;
  $('orla-duration').textContent=totalMinutes(selected)+' min';
  $('orla-copy').disabled=$('orla-clear').disabled=selected.length===0;
  buttons.forEach(button=>{
   const active=selected.includes(button.dataset.select);
   button.setAttribute('aria-pressed',String(active));
   button.firstChild.textContent=active?'Selecionado ':'Adicionar ';
   button.closest('.service-card').classList.toggle('is-selected',active);
  });
 };
 chips.forEach(button=>button.addEventListener('click',()=>{
  category=button.dataset.filter;
  chips.forEach(chip=>chip.setAttribute('aria-pressed',String(chip===button)));
  cards.forEach(card=>{card.hidden=category!=='todos'&&card.dataset.category!==category;});
 }));
 buttons.forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.select,index=selected.indexOf(id);
  if(index>=0){selected.splice(index,1);notify('Serviço removido.');}
  else if(selected.length>=MAX){notify('Escolha até três serviços. Remova um para selecionar outro.');return;}
  else{selected.push(id);notify(services[id].name+' incluído no seu briefing.');}
  redraw();
 }));
 $('orla-clear').addEventListener('click',()=>{selected.length=0;redraw();notify('Escolhas apagadas desta página.');});
 $('orla-copy').addEventListener('click',async()=>{
  try{const summary=createBrief(selected,$('orla-style').value,$('orla-period').value);
    await navigator.clipboard.writeText(summary);notify('Resumo copiado. Nenhuma informação foi enviada.');}
  catch{notify('Não foi possível copiar automaticamente. O navegador pode bloquear o acesso à área de transferência.');}
 });
 const toggle=document.querySelector('.nav-toggle'),mobile=$('orla-mobile');
 const close=()=>{mobile.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.textContent='Menu';};
 toggle.addEventListener('click',()=>{const open=mobile.hidden;mobile.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Fechar':'Menu';});
 mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mobile.hidden){close();toggle.focus();}});
 redraw();
});
})();