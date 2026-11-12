'use strict';
/* 21 experiências de catálogo, informação e seleção local. Sem rede, cookies, armazenamento ou transação. */
(function(global){
 function normalize(str){return String(str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
 function uniqueSelection(current,id,max=2){if(!Number.isInteger(id)||id<0)throw new RangeError('Índice inválido.');const list=[...current],at=list.indexOf(id);if(at!==-1){list.splice(at,1);return list;}if(list.length>=max)throw new RangeError('Escolha no máximo '+max+' referências.');list.push(id);return list;}
 function summary(brand,cards,ids){if(!ids.length)throw new RangeError('Seleção vazia.');return ['USBRIN PORTFÓLIO — INSPIRAÇÃO ILUSTRATIVA','Marca conceitual: '+brand,...ids.map(i=>'• '+cards[i].name+': '+cards[i].desc),'Esta lista é apenas referência de interface, sem preço, contratação, reserva ou envio.'].join('\n');}
 if(typeof module!=='undefined'&&module.exports)module.exports={normalize,uniqueSelection,summary};
 if(typeof document==='undefined')return;
 document.addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id),root=document.body,widget=root.dataset.widget,brand=document.querySelector('.brand>span:last-child')?.firstChild?.textContent?.trim()||'Projeto USBRIN';
 const cards=[...document.querySelectorAll('.concept-card')].map(node=>({node,name:node.querySelector('h3').textContent,desc:node.querySelector('.card-body p').textContent,group:node.dataset.group}));
 const toggle=document.querySelector('.menu-trigger'),nav=$('concept-mobile');
 function closeNav(){nav.hidden=true;toggle.textContent='Menu';toggle.setAttribute('aria-expanded','false');}
 toggle.addEventListener('click',()=>{const open=nav.hidden;nav.hidden=!open;toggle.textContent=open?'Fechar':'Menu';toggle.setAttribute('aria-expanded',String(open));});
 nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeNav));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!nav.hidden){closeNav();toggle.focus();}});
 if(widget==='explore'){
   const choices=[...document.querySelectorAll('[data-filter]')];
   choices.forEach(button=>button.addEventListener('click',()=>{
     const active=button.dataset.filter;choices.forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
     cards.forEach(c=>c.node.hidden=active!=='todos'&&c.group!==active);
   }));
   document.querySelectorAll('[data-focus]').forEach(button=>button.addEventListener('click',()=>{
     const index=Number(button.dataset.focus),item=cards[index];
     if(!item)return;
     $('focus-title').textContent=item.name;$('focus-description').textContent=item.desc;$('focus-tag').textContent=item.group;
     document.querySelectorAll('[data-focus]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   }));
 }
 if(widget==='tabs'){
   const buttons=[...document.querySelectorAll('button[data-tab]')];
   function activate(button,focus=false){const index=Number(button.dataset.tab),card=cards[index];if(!card)return;
     buttons.forEach(b=>{b.setAttribute('aria-selected',String(b===button));b.tabIndex=b===button?0:-1;});
     $('detail-title').textContent=card.name;$('detail-description').textContent=card.desc;$('detail-group').textContent=card.group;
     if(focus)button.focus();
   }
   buttons.forEach((button,i)=>{button.addEventListener('click',()=>activate(button));button.addEventListener('keydown',e=>{let next=i;if(e.key==='ArrowRight')next=(i+1)%buttons.length;else if(e.key==='ArrowLeft')next=(i+buttons.length-1)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();activate(buttons[next],true);});});
 }
 if(widget==='chooser'){
   let selected=[];const buttons=[...document.querySelectorAll('[data-select]')],container=$('selection-list'),copy=$('copy-summary'),clear=$('clear-selection'),status=$('interaction-status');
   function draw(){container.replaceChildren();if(!selected.length){let p=document.createElement('p');p.textContent='Nenhuma referência selecionada.';container.append(p);}else selected.forEach(i=>{const row=document.createElement('div');row.className='selection-row';const name=document.createElement('span');name.textContent=cards[i].name;const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.setAttribute('aria-label','Remover '+cards[i].name);remove.addEventListener('click',()=>{selected=uniqueSelection(selected,i);draw();status.textContent='Referência removida.';});row.append(name,remove);container.append(row);});
     buttons.forEach(b=>{let active=selected.includes(Number(b.dataset.select));b.setAttribute('aria-pressed',String(active));b.firstChild.textContent=active?'Selecionada ':'Adicionar referência ';});
     copy.disabled=clear.disabled=!selected.length;
   }
   buttons.forEach(button=>button.addEventListener('click',()=>{try{selected=uniqueSelection(selected,Number(button.dataset.select));status.textContent='Seleção atualizada nesta página.';}catch(e){status.textContent=e.message;}draw();}));
   clear.addEventListener('click',()=>{selected=[];draw();status.textContent='Referências limpas.';});
   copy.addEventListener('click',async()=>{if(!selected.length)return;try{await navigator.clipboard.writeText(summary(brand,cards,selected));status.textContent='Resumo copiado. Não foi enviado.';}catch{status.textContent='Não foi possível copiar. Seu navegador pode bloquear a área de transferência.';}});
   draw();
 }
 });
})(typeof globalThis!=='undefined'?globalThis:this);
