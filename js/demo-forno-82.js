'use strict';
/* Forno 82 — demonstração local, sem API, transação, armazenamento ou dados pessoais. */
(function(global){
const catalog=Object.freeze({
  margherita:{name:'Margherita 82',cents:4900},
  brasata:{name:'Brasata',cents:5800},
  jardim:{name:'Jardim da Casa',cents:5400},
  quatro:{name:'Quatro Queijos',cents:6100},
  napoli:{name:'Napoli',cents:4700},
  horta:{name:'Da Horta',cents:5200}
});
const MAX_QUANTITY=8;
const formatBRL=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function calculateSelection(id,size,edge,quantity){
  if(!Object.hasOwn(catalog,id))throw new RangeError('Sabor inválido.');
  if(!['individual','grande'].includes(size))throw new RangeError('Tamanho inválido.');
  if(!['simples','recheada'].includes(edge))throw new RangeError('Acabamento inválido.');
  if(!Number.isInteger(quantity)||quantity<1||quantity>5)throw new RangeError('Escolha entre 1 e 5 pizzas.');
  const unit=catalog[id].cents+(size==='grande'?2800:0)+(edge==='recheada'?900:0);
  return {id,name:catalog[id].name,size,edge,quantity,unitCents:unit,totalCents:unit*quantity};
}
function totalCents(lines){return lines.reduce((sum,line)=>sum+line.unitCents*line.quantity,0)}
function totalQuantity(lines){return lines.reduce((sum,line)=>sum+line.quantity,0)}
if(typeof module!=='undefined'&&module.exports){module.exports={catalog,MAX_QUANTITY,normalize,calculateSelection,totalCents,totalQuantity};}
if(typeof document==='undefined')return;
document.addEventListener('DOMContentLoaded',()=>{
 const $=selector=>document.querySelector(selector);
 const byId=id=>document.getElementById(id);
 const menuButtons=[...document.querySelectorAll('[data-kind]')].filter(node=>node.tagName==='BUTTON');
 const pizzas=[...document.querySelectorAll('.pizza[data-kind]')];
 const search=byId('pizza-search');
 const menuCount=byId('menu-count');
 const empty=byId('menu-empty');
 let currentKind='todos';
 function filterMenu(){
  const q=normalize(search.value);let visible=0;
  pizzas.forEach(pizza=>{
   const category=currentKind==='todos'||pizza.dataset.kind===currentKind;
   const matches=normalize(pizza.dataset.terms+' '+pizza.textContent).includes(q);
   pizza.hidden=!(category&&matches);
   if(!pizza.hidden)visible++;
  });
  menuCount.textContent=visible===1?'1 sabor na demonstração':visible+' sabores na demonstração';
  empty.hidden=visible>0;
 }
 menuButtons.forEach(button=>button.addEventListener('click',()=>{
  currentKind=button.dataset.kind;
  menuButtons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  filterMenu();
 }));
 search.addEventListener('input',filterMenu);
 filterMenu();
 const mobileTrigger=$('.menu-trigger'),mobileLinks=byId('mobile-links');
 function closeMobile(){mobileLinks.hidden=true;mobileTrigger.setAttribute('aria-expanded','false');mobileTrigger.textContent='Menu'}
 mobileTrigger.addEventListener('click',()=>{
  const open=mobileLinks.hidden;
  mobileLinks.hidden=!open;
  mobileTrigger.setAttribute('aria-expanded',String(open));
  mobileTrigger.textContent=open?'Fechar':'Menu';
 });
 mobileLinks.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMobile));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!mobileLinks.hidden){closeMobile();mobileTrigger.focus();}});
 const flavor=byId('pizza-flavor'),size=byId('pizza-size'),edge=byId('pizza-edge'),qty=byId('pizza-qty'),preview=byId('pizza-preview');
 const orderItems=byId('order-items'),count=byId('order-count'),total=byId('order-total'),copy=byId('order-copy'),clear=byId('order-clear'),status=byId('order-status');
 const lines=[];
 const notify=msg=>{status.textContent=msg;};
 function readSelection(){return calculateSelection(flavor.value,size.value,edge.value,Number(qty.value));}
 function updatePreview(){
  try{preview.textContent=formatBRL(readSelection().totalCents);}
  catch{preview.textContent='Verifique a quantidade';}
 }
 [flavor,size,edge,qty].forEach(field=>field.addEventListener('input',updatePreview));
 document.querySelectorAll('[data-pick]').forEach(button=>button.addEventListener('click',()=>{
  flavor.value=button.dataset.pick;
  qty.value='1';updatePreview();
  byId('pedido').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  flavor.focus({preventScroll:true});
  notify('Sabor selecionado. Configure sua escolha para incluir na lista.');
 }));
 function renderOrder(){
  orderItems.replaceChildren();
  if(!lines.length){
   const p=document.createElement('p');p.className='order-placeholder';p.textContent='Sua seleção está vazia. Escolha um sabor no cardápio para começar.';orderItems.append(p);
  }else{
   lines.forEach((line,index)=>{
    const item=document.createElement('div');item.className='order-item';
    const info=document.createElement('div');
    const name=document.createElement('strong');name.textContent=line.quantity+' × '+line.name;
    const detail=document.createElement('small');detail.textContent=(line.size==='grande'?'Grande':'Individual')+' · '+(line.edge==='recheada'?'Borda especial':'Borda tradicional')+' · '+formatBRL(line.unitCents)+' cada';
    const price=document.createElement('small');price.textContent='Subtotal: '+formatBRL(line.unitCents*line.quantity);
    info.append(name,detail,price);
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.setAttribute('aria-label','Remover '+line.name+' da seleção');
    remove.addEventListener('click',()=>{lines.splice(index,1);renderOrder();notify('Item removido da simulação.');});
    item.append(info,remove);orderItems.append(item);
   });
  }
  const totalQty=totalQuantity(lines);
  count.textContent=totalQty+' de '+MAX_QUANTITY+' pizzas';
  total.textContent=formatBRL(totalCents(lines));
  copy.disabled=clear.disabled=lines.length===0;
 }
 byId('pizza-form').addEventListener('submit',event=>{
  event.preventDefault();
  try{
   const item=readSelection();
   if(totalQuantity(lines)+item.quantity>MAX_QUANTITY){notify('Limite demonstrativo de '+MAX_QUANTITY+' pizzas atingido. Remova itens ou reduza a quantidade.');return;}
   const found=lines.find(line=>line.id===item.id&&line.size===item.size&&line.edge===item.edge);
   if(found)found.quantity+=item.quantity;
   else lines.push({...item});
   renderOrder();notify('Escolha adicionada à seleção ilustrativa. Nenhum pedido foi criado.');
  }catch(error){notify(error.message||'Revise os campos informados.');}
 });
 clear.addEventListener('click',()=>{lines.length=0;renderOrder();notify('Seleção demonstrativa limpa.');});
 copy.addEventListener('click',async()=>{
  if(!lines.length)return;
  const summary=['FORNO 82 — LISTA ILUSTRATIVA (NÃO É PEDIDO)',
   ...lines.map(line=>line.quantity+' × '+line.name+' / '+(line.size==='grande'?'Grande':'Individual')+' / '+(line.edge==='recheada'?'Borda especial':'Borda tradicional')+' — '+formatBRL(line.unitCents*line.quantity)),
   'Total de referência: '+formatBRL(totalCents(lines)),
   'Exemplo de interface USBRIN. Sem disponibilidade, pagamento ou envio.'].join('\n');
  try{await navigator.clipboard.writeText(summary);notify('Resumo demonstrativo copiado. Não foi enviado.');}
  catch{notify('Não foi possível copiar automaticamente. O navegador pode bloquear o acesso à área de transferência.');}
 });
 updatePreview();renderOrder();
});
})(typeof globalThis!=='undefined'?globalThis:this);
