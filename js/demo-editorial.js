/* USBRIN Editorial — interações locais, sem reservas, pedidos, pagamentos ou armazenamento. */
document.addEventListener('DOMContentLoaded',()=>{
'use strict';
const api=window.USBRINEditorial;if(!api)return;
const $=q=>document.querySelector(q);
const mode=document.body.dataset.editorial;
const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
const node=(tag,className,text)=>{const x=document.createElement(tag);if(className)x.className=className;if(text!==undefined)x.textContent=text;return x;};
const image=(src,alt)=>{const img=node('img');img.src=src;img.alt=alt;img.loading='lazy';img.decoding='async';img.width=1200;img.height=900;img.addEventListener('error',()=>{img.alt='Fotografia de referência indisponível';img.style.opacity='.18';},{once:true});return img;};
const nav=$('#editorial-nav'),toggle=$('.menu-toggle');
if(nav&&toggle){
 const close=()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='Menu';};
 toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Fechar':'Menu';});
 nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){close();toggle.focus();}});
}
async function copyText(value,status){
 try{
  if(!navigator.clipboard?.writeText)throw Error('Indisponível');
  await navigator.clipboard.writeText(value);status.textContent='Resumo ilustrativo copiado.';
 }catch{status.textContent='Cópia automática indisponível. As informações seguem visíveis na página.';}
}
if(mode==='cafe'){
 const filters=$('#cafe-filters'),cards=$('#cafe-items'),search=$('#cafe-search'),sortControl=$('#cafe-sort');
 const selectedEl=$('#cafe-selected'),counter=$('#cafe-selected-count'),total=$('#cafe-total'),status=$('#cafe-copy-status');
 let category='Todos',order='destaques',items=[],selectedMoment='pausa';
 const allCategories=['Todos','Cafés','Comidas','Doces'];
 function filterUI(){
  filters.replaceChildren();
  for(const cat of allCategories){
   const btn=node('button',null,cat);btn.type='button';btn.dataset.category=cat;btn.setAttribute('aria-pressed',String(cat===category));
   btn.addEventListener('click',()=>{category=cat;filterUI();renderMenu();});
   filters.append(btn);
  }
 }
 function add(id){
  const existing=items.find(x=>x.id===id);
  if(existing&&existing.quantity>=10){status.textContent='Limite ilustrativo de dez unidades por item.';return;}
  if(!existing&&items.length>=4){status.textContent='Selecione no máximo quatro itens diferentes.';return;}
  items=existing?items.map(x=>x.id===id?{id,quantity:x.quantity+1}:x):[...items,{id,quantity:1}];
  status.textContent='Item incluído na seleção demonstrativa.';
  renderSelected();
 }
 function renderMenu(){
  const list=api.catalog(category,search.value,order);
  cards.replaceChildren();
  for(const item of list){
   const card=node('article','item-card');card.dataset.item=item.id;
   const visual=node('div','item-photo');visual.append(image(item.photo,'Fotografia editorial de referência para '+item.name));
   const info=node('div','item-detail');info.append(node('span',null,item.category),node('h3',null,item.name),node('p',null,item.description),node('small','item-note',item.note));
   const bottom=node('div','item-bottom');bottom.append(node('strong',null,money(item.price)));
   const btn=node('button',null,'Incluir +');btn.type='button';btn.dataset.add=item.id;btn.setAttribute('aria-label','Adicionar '+item.name+' à seleção demonstrativa');btn.addEventListener('click',()=>add(item.id));
   bottom.append(btn);info.append(bottom);card.append(visual,info);cards.append(card);
  }
  $('#cafe-results').textContent=list.length===1?'1 referência encontrada':list.length+' referências encontradas';
  $('#cafe-empty').hidden=list.length>0;
 }
 function renderSelected(){
  selectedEl.replaceChildren();
  const result=api.selection(items);
  if(!items.length)selectedEl.append(node('p','panel-help','Sua seleção de referência aparecerá aqui.'));
  else for(const line of result.items){
   const item=api.menu.find(x=>x.id===line.id);
   const row=node('div','selected-row');row.append(image(item.photo,'Referência visual de '+item.name));
   const labels=node('div');labels.append(node('strong',null,item.name),node('small',null,money(line.subtotal)+' · hipotético'));
   const qty=node('input','qty-control');qty.type='number';qty.min='1';qty.max='10';qty.step='1';qty.value=String(line.quantity);
   qty.setAttribute('aria-label','Quantidade de '+item.name);
   qty.addEventListener('change',()=>{const n=Number(qty.value);if(!Number.isInteger(n)||n<1||n>10){qty.value=String(line.quantity);status.textContent='Use quantidade inteira de 1 a 10.';return;}items=items.map(x=>x.id===line.id?{id:line.id,quantity:n}:x);renderSelected();});
   const remove=node('button',null,'Remover');remove.type='button';remove.setAttribute('aria-label','Remover '+item.name);remove.addEventListener('click',()=>{items=items.filter(x=>x.id!==line.id);renderSelected();});
   row.append(labels,qty,remove);selectedEl.append(row);
  }
  total.textContent=money(result.total);counter.textContent=items.length+' de 4 itens';
  $('#cafe-copy').disabled=items.length===0;
 }
 function renderMoments(){
  const holder=$('#cafe-moments');holder.replaceChildren();
  for(const option of api.moments){
   const btn=node('button',null,option.label);btn.type='button';btn.dataset.moment=option.id;btn.setAttribute('aria-pressed',String(selectedMoment===option.id));
   btn.addEventListener('click',()=>{selectedMoment=option.id;renderMoments();});
   holder.append(btn);
  }
  const current=api.moment(selectedMoment),panel=$('#cafe-moment-result');panel.replaceChildren();
  panel.append(node('strong',null,current.label),node('span',null,current.summary+' '+current.ids.map(id=>api.menu.find(x=>x.id===id).name).join(' + ')+'.'));
 }
 $('#cafe-add-moment').addEventListener('click',()=>{
  const current=api.moment(selectedMoment),missing=current.ids.filter(id=>!items.some(x=>x.id===id));
  if(items.length+missing.length>4){status.textContent='Esta sugestão excede o limite de quatro itens. Remova uma escolha antes.';return;}
  items=[...items,...missing.map(id=>({id,quantity:1}))];status.textContent='Sugestão incluída como referência, sem pedido real.';renderSelected();
 });
 $('#cafe-copy').addEventListener('click',()=>{const summary=api.sampleBrief(items);if(summary)copyText(summary,status);});
 $('#cafe-clear').addEventListener('click',()=>{items=[];status.textContent='Seleção limpa.';renderSelected();});
 search.addEventListener('input',renderMenu);
 sortControl.addEventListener('change',()=>{order=sortControl.value;renderMenu();});
 filterUI();renderMenu();renderMoments();renderSelected();
}
if(mode==='photo'){
 const categories=['Todos','Retratos','Editorial','Histórias'],filters=$('#helena-tabs'),grid=$('#helena-gallery'),dialog=$('#helena-dialog');
 let category='Todos',visible=api.gallery(category),index=0;
 const modalImg=$('#helena-modal-image');
 function renderFilters(){
  filters.replaceChildren();
  for(const name of categories){
   const btn=node('button',null,name);btn.type='button';btn.dataset.category=name;btn.setAttribute('aria-pressed',String(category===name));
   btn.addEventListener('click',()=>{category=name;visible=api.gallery(category);renderFilters();renderGallery();});
   filters.append(btn);
  }
 }
 function show(indexToShow){
  if(!visible.length)return;
  index=(indexToShow+visible.length)%visible.length;
  const item=visible[index];
  modalImg.src=item.photo;modalImg.alt='Fotografia editorial externa intitulada '+item.title+'. Não é trabalho da marca.';
  $('#helena-modal-title').textContent=item.title;
  $('#helena-modal-category').textContent=item.category+' · '+(index+1)+' / '+visible.length+' · IMAGEM DE REFERÊNCIA';
  $('#helena-modal-caption').textContent=item.caption;
  if(!dialog.open)dialog.showModal();
 }
 function renderGallery(){
  grid.replaceChildren();
  for(const [i,item] of visible.entries()){
   const btn=node('button','photo-tile');btn.type='button';btn.dataset.photo=item.id;btn.dataset.shape=item.shape;btn.setAttribute('aria-label','Ampliar fotografia de referência '+item.title);
   btn.append(image(item.photo,'Fotografia editorial de referência: '+item.title));
   const overlay=node('span','photo-overlay');overlay.append(node('strong',null,item.title),node('small',null,item.category.toUpperCase()+' · AMPLIAR ↗'));btn.append(overlay);
   btn.addEventListener('click',()=>show(i));grid.append(btn);
  }
  $('#helena-count').textContent=visible.length===1?'1 imagem de referência':visible.length+' imagens de referência';
 }
 $('#helena-close').addEventListener('click',()=>dialog.close());
 $('#helena-prev').addEventListener('click',()=>show(index-1));
 $('#helena-next').addEventListener('click',()=>show(index+1));
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 document.addEventListener('keydown',e=>{if(!dialog.open)return;if(e.key==='ArrowLeft'){e.preventDefault();show(index-1);}if(e.key==='ArrowRight'){e.preventDefault();show(index+1);}});
 const form=$('#session-form'),type=$('#session-type'),place=$('#session-place'),delivery=$('#session-delivery'),notes=$('#session-notes'),preview=$('#session-preview'),status=$('#session-status');
 const input=()=>({type:type.value,place:place.value,delivery:delivery.value,notes:notes.value});
 const renderBrief=()=>{preview.textContent=api.sessionBrief(input())||'Confira os campos antes de continuar.';$('#session-copy').disabled=!api.session(input());};
 [type,place,delivery,notes].forEach(control=>control.addEventListener(control===notes?'input':'change',renderBrief));
 form.addEventListener('submit',e=>e.preventDefault());
 $('#session-copy').addEventListener('click',()=>{const brief=api.sessionBrief(input());if(brief)copyText(brief,status);});
 $('#session-reset').addEventListener('click',()=>{type.value='retrato';place.value='estudio';delivery.value='digital';notes.value='';status.textContent='';renderBrief();});
 renderFilters();renderGallery();renderBrief();
}
});
