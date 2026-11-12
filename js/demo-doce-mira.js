'use strict';
/* Doce Mira: experiência de composição em memória. Não conecta a pagamentos, agenda ou atendimento. */
(function(){
 const flavors=Object.freeze({baunilha:{label:'Baunilha & frutas',cents:8900},chocolate:{label:'Chocolate intenso',cents:9800},limao:{label:'Limão delicado',cents:8700}});
 const sizes=Object.freeze({'10':{label:'10 porções',extra:0},'20':{label:'20 porções',extra:5200},'30':{label:'30 porções',extra:9900}});
 const finishes=Object.freeze({classico:{label:'Clássico',cents:0},floral:{label:'Floral',cents:1800},minimal:{label:'Minimalista',cents:1000}});
 const extras=Object.freeze({nenhum:{label:'Sem complemento',cents:0},frutas:{label:'Frutas',cents:1400},chocolate:{label:'Detalhes de chocolate',cents:1600}});
 const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
 function estimate(flavor,size,finish,extra){
   if(!Object.hasOwn(flavors,flavor)||!Object.hasOwn(sizes,size)||!Object.hasOwn(finishes,finish)||!Object.hasOwn(extras,extra))throw new RangeError('Opção desconhecida.');
   const total=flavors[flavor].cents+sizes[size].extra+finishes[finish].cents+extras[extra].cents;
   return {flavor:flavors[flavor].label,size:sizes[size].label,finish:finishes[finish].label,extra:extras[extra].label,totalCents:total};
 }
 const summaryText=o=>['DOCE MIRA — REFERÊNCIA CONCEITUAL, NÃO É ENCOMENDA','Sabor: '+o.flavor,'Porções: '+o.size,'Acabamento: '+o.finish,'Complemento: '+o.extra,'Valor ilustrativo: '+money(o.totalCents),'Não há confeitaria, disponibilidade, pedido, entrega ou pagamento real.'].join('\n');
 if(typeof module!=='undefined'&&module.exports)module.exports={flavors,sizes,finishes,extras,normalize,estimate,summaryText};
 if(typeof document==='undefined')return;
 document.addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id);
 const cards=[...document.querySelectorAll('.product[data-category]')],filters=[...document.querySelectorAll('button[data-filter]')];
 const search=$('doce-search'),results=$('doce-results'),empty=$('doce-empty');
 let category='todos',prepared=null;
 function renderList(){const q=normalize(search.value);let count=0;cards.forEach(card=>{card.hidden=!((category==='todos'||card.dataset.category===category)&&normalize(card.dataset.terms+' '+card.textContent).includes(q));if(!card.hidden)count++;});results.textContent=count===1?'1 referência':count+' referências';empty.hidden=count>0;}
 filters.forEach(button=>button.addEventListener('click',()=>{category=button.dataset.filter;filters.forEach(x=>x.setAttribute('aria-pressed',String(x===button)));renderList();}));search.addEventListener('input',renderList);
 const fields=[$('doce-flavor'),$('doce-size'),$('doce-finish'),$('doce-extra')];
 function getEstimate(){return estimate(...fields.map(x=>x.value));}
 function clearSummary(){prepared=null;$('doce-copy').disabled=true;$('doce-summary-lines').replaceChildren();const p=document.createElement('p');p.textContent='Suas escolhas estão prontas para gerar um novo resumo. Clique em “Preparar meu resumo”.';$('doce-summary-lines').append(p);}
 function showPrice(){try{$('doce-price').textContent=money(getEstimate().totalCents);clearSummary();}catch{$('doce-price').textContent='Opção inválida';}}
 fields.forEach(x=>x.addEventListener('change',()=>{showPrice();$('doce-status').textContent='Escolhas atualizadas. Prepare um novo resumo.';}));
 document.querySelectorAll('[data-flavor]').forEach(a=>a.addEventListener('click',()=>{$('doce-flavor').value=a.dataset.flavor;showPrice();$('doce-status').textContent='Sabor escolhido no catálogo.';}));
 $('doce-form').addEventListener('submit',event=>{event.preventDefault();try{prepared=getEstimate();const box=$('doce-summary-lines');box.replaceChildren();for(const [label,value] of [['Sabor',prepared.flavor],['Porções',prepared.size],['Acabamento',prepared.finish],['Complemento',prepared.extra],['Total hipotético',money(prepared.totalCents)]]){const row=document.createElement('div');row.className='summary-line';const key=document.createElement('span');key.textContent=label;const val=document.createElement('strong');val.textContent=value;row.append(key,val);box.append(row);} $('doce-copy').disabled=false;$('doce-summary-note').textContent='Uma composição ilustrativa, sem disponibilidade ou contratação.';$('doce-status').textContent='Resumo preparado localmente. Nenhuma encomenda foi criada.';}catch(e){$('doce-status').textContent=e.message;}});
 $('doce-copy').addEventListener('click',async()=>{if(!prepared)return;try{await navigator.clipboard.writeText(summaryText(prepared));$('doce-status').textContent='Resumo copiado; não foi enviado a ninguém.';}catch{$('doce-status').textContent='Seu navegador não permitiu copiar automaticamente.';}});
 $('doce-reset').addEventListener('click',()=>{$('doce-form').reset();showPrice();$('doce-summary-note').textContent='Ajuste as escolhas e prepare um resumo para visualizar sua composição.';$('doce-status').textContent='Composição restaurada.';});
 const toggle=document.querySelector('.mobile-toggle'),nav=$('doce-mobile');
 const close=()=>{nav.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.textContent='Menu';};
 toggle.addEventListener('click',()=>{const open=nav.hidden;nav.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Fechar':'Menu';});
 nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',close));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!nav.hidden){close();toggle.focus();}});
 renderList();showPrice();
 });
})();