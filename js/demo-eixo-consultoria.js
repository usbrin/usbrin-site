'use strict';
/* Eixo: roteiros editoriais determinísticos; sem API, dados financeiros, coleta ou previsão. */
(function(){
const stages=Object.freeze({
 inicio:{label:'Estruturação',step:'Documente a proposta de valor, a hipótese de cliente e a rotina mínima necessária para entregar.'},
 rotina:{label:'Operação',step:'Escolha um processo recorrente, defina o responsável e registre como será acompanhado.'},
 expansao:{label:'Expansão',step:'Antes de ampliar custos fixos, registre os sinais de demanda repetível e a capacidade de atendimento.'}
});
const challenges=Object.freeze({
 receita:{label:'Receita',step:'Descreva a oferta principal, como os clientes chegam e qual evidência de demanda ainda falta testar.'},
 margem:{label:'Margem',step:'Organize preço, custos diretos e esforço de entrega antes de considerar ampliar o volume.'},
 processos:{label:'Processos',step:'Escolha uma rotina crítica e documente entrada, responsável, entrega e ponto de verificação.'},
 caixa:{label:'Caixa',step:'Liste entradas, saídas e compromissos por período para identificar necessidades de liquidez.'}
});
const horizons=Object.freeze({agora:'Próximas semanas',trimestre:'Próximo trimestre',sempressa:'Sem prazo definido'});
function generateMap(stage,selected,horizon){
 if(!Object.hasOwn(stages,stage)||!Object.hasOwn(horizons,horizon))throw new RangeError('Escolha uma fase e um horizonte válidos.');
 if(!Array.isArray(selected)||selected.length<1||selected.length>2||new Set(selected).size!==selected.length||selected.some(x=>!Object.hasOwn(challenges,x)))throw new RangeError('Selecione de um a dois desafios válidos.');
 const steps=[stages[stage].step,...selected.map(id=>challenges[id].step)];
 if(steps.length<3)steps.push('Defina um indicador simples para acompanhar a hipótese e revise o que aprendeu antes de investir mais.');
 return {stage:stages[stage].label,challengeLabels:selected.map(id=>challenges[id].label),horizon:horizons[horizon],steps};
}
function toSummary(map){
 if(!map||!Array.isArray(map.steps)||map.steps.length!==3)throw new RangeError('Mapa inválido.');
 return ['EIXO CONSULTORIA — MAPA EDITORIAL, NÃO É DIAGNÓSTICO',
 'Fase: '+map.stage,'Desafios: '+map.challengeLabels.join(', '),'Horizonte: '+map.horizon,
 ...map.steps.map((step,index)=>(index+1)+'. '+step),
 'Projeto autoral USBRIN. Sugestões genéricas, sem avaliação individual ou resultados garantidos.'].join('\n');
}
if(typeof module!=='undefined'&&module.exports)module.exports={stages,challenges,horizons,generateMap,toSummary};
if(typeof document==='undefined')return;
document.addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id);
 const selected=[...document.querySelectorAll('input[name="challenge"]')];
 const status=$('eixo-status');
 let current=null;
 const notify=msg=>{status.textContent=msg;};
 const toggle=document.querySelector('.nav-toggle'),nav=$('eixo-mobile');
 const close=()=>{nav.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.textContent='Menu';};
 toggle.addEventListener('click',()=>{const isOpen=nav.hidden;nav.hidden=!isOpen;toggle.setAttribute('aria-expanded',String(isOpen));toggle.textContent=isOpen?'Fechar':'Menu';});
 nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!nav.hidden){close();toggle.focus();}});
 selected.forEach(chk=>chk.addEventListener('change',()=>{
  if(selected.filter(x=>x.checked).length>2){chk.checked=false;notify('Escolha no máximo dois desafios para este mapa.');}
  else notify('');
 }));
 function redraw(map){
  $('map-steps').replaceChildren();
  for(const step of map.steps){const li=document.createElement('li');li.textContent=step;$('map-steps').append(li);}
  $('map-title').textContent='Seu ponto de partida';
  $('map-subtitle').textContent='Fase: '+map.stage+' · Desafios: '+map.challengeLabels.join(' e ')+' · Horizonte: '+map.horizon+'.';
  $('eixo-copy').disabled=false;
 }
 $('eixo-form').addEventListener('submit',event=>{
  event.preventDefault();
  try{const list=selected.filter(x=>x.checked).map(x=>x.value);
   current=generateMap($('eixo-stage').value,list,$('eixo-horizon').value);
   redraw(current);notify('Mapa ilustrativo criado nesta página, sem envio de informações.');
  }catch(e){current=null;$('eixo-copy').disabled=true;notify(e.message||'Revise suas escolhas.');}
 });
 $('eixo-copy').addEventListener('click',async()=>{
  if(!current)return;
  try{await navigator.clipboard.writeText(toSummary(current));notify('Resumo ilustrativo copiado. Nenhuma informação foi enviada.');}
  catch{notify('O navegador não permitiu copiar automaticamente.');}
 });
 $('eixo-reset').addEventListener('click',()=>{
  $('eixo-form').reset();current=null;$('eixo-copy').disabled=true;
  $('map-title').textContent='Primeiro, clareza.';
  $('map-subtitle').textContent='Selecione os desafios ao lado para gerar três passos editoriais e um resumo copiável.';
  $('map-steps').replaceChildren();
  ['Escolha a fase do negócio','Marque até dois desafios','Gere um roteiro de referência'].forEach(s=>{let li=document.createElement('li');li.textContent=s;$('map-steps').append(li);});
  notify('Mapa reiniciado. Nenhuma informação foi armazenada.');
 });
});
})();