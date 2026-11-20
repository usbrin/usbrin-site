/* USBRIN Retail Lab / Interface — decisões locais, sem backend, compras ou coleta de dados. */
document.addEventListener('DOMContentLoaded',()=>{
'use strict';
const model=window.USBRINRetail; if(!model)return;
const $=selector=>document.querySelector(selector), all=selector=>[...document.querySelectorAll(selector)];
const kind=document.body.dataset.retail; if(!['fashion','materials'].includes(kind))return;
const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const source=kind==='fashion'?model.fashion:model.materials;
let category='Todos',sort='destaques',current=null,chosen=[],quote=[];
// Handlers compartilhados com cartões do catálogo, definidos em cada experiência.
let toggleLook=()=>{},addQuote=()=>{};
const cards=$('#retail-cards'),filters=$('#retail-filters'),search=$('#retail-search'),sorter=$('#retail-sort'),dialog=$('#retail-dialog'),toast=$('#retail-toast');
let toastTimer;
function announce(message){toast.textContent=message;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,2500);}
function addText(parent,tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el;}
function el(tag,cls){const e=document.createElement(tag);if(cls)e.className=cls;return e;}
const menu=$('.menu-toggle'),nav=$('#retail-nav');
if(menu&&nav){
 const close=()=>{menu.textContent='Menu';menu.setAttribute('aria-expanded','false');nav.classList.remove('open');};
 menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.textContent=open?'Fechar':'Menu';menu.setAttribute('aria-expanded',String(open));});
 nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){close();menu.focus();}});
}
function renderFilters(){
 filters.replaceChildren();
 for(const name of model.shoppingFilters[kind]){
  const b=addText(filters,'button',name);b.type='button';b.dataset.category=name;b.setAttribute('aria-pressed',String(name===category));
  b.addEventListener('click',()=>{category=name;renderFilters();renderCatalog();});
 }
}
function makeImage(src,alt){const img=document.createElement('img');img.src=src;img.alt=alt;img.loading='lazy';img.decoding='async';img.width=1000;img.height=850;img.addEventListener('error',()=>{img.style.opacity='.2';img.alt='Fotografia de referência indisponível';},{once:true});return img;}
function renderCatalog(){
 const list=model.catalog(kind,category,search.value,sort);cards.replaceChildren();
 for(const item of list){
  const article=el('article','product-card');article.dataset.product=item.id;
  const media=el('button','product-media');media.type='button';media.setAttribute('aria-label','Conhecer '+item.name);media.append(makeImage(item.photo,'Fotografia de referência: '+item.name));addText(media,'span','FOTO DE REFERÊNCIA','media-label');
  media.addEventListener('click',()=>showDetail(item));
  const content=el('div','product-content');addText(content,'span',item.type);addText(content,'h3',item.name);addText(content,'p',item.description);
  const price=addText(content,'strong',money(item.price),'price');addText(price,'small','Valor ilustrativo por '+(kind==='fashion'?'peça':item.unit));
  const buttons=el('div','card-buttons');
  const detailBtn=addText(buttons,'button','Ver detalhes');detailBtn.type='button';detailBtn.addEventListener('click',()=>showDetail(item));
  const addBtn=addText(buttons,'button',kind==='fashion'?(chosen.includes(item.id)?'Selecionado ✓':'Adicionar ao look +'):'Incluir na lista +','add');
  addBtn.type='button';addBtn.dataset.add=item.id;
  if(kind==='fashion')addBtn.setAttribute('aria-pressed',String(chosen.includes(item.id)));
  addBtn.addEventListener('click',()=>{if(kind==='fashion')toggleLook(item.id);else addQuote(item.id,1);});
  article.append(media,content);content.append(buttons);cards.append(article);
 }
 $('#retail-count').textContent=list.length===1?'1 peça disponível':list.length+' itens disponíveis';
 $('#retail-empty').hidden=list.length>0;
}
function showDetail(item){
 current=item;
 const img=$('#detail-photo');img.src=item.photo;img.alt='Fotografia de ambiente relacionada a '+item.name;
 $('#detail-type').textContent=item.type+' · referência conceitual';
 $('#detail-name').textContent=item.name;
 $('#detail-desc').textContent=item.description;
 $('#detail-value').textContent=money(item.price)+(kind==='materials'?' / '+item.unit:'');
 if(kind==='fashion'){$('#detail-size').value='M';updateGuide();}
 else $('#detail-qty').value='1';
 dialog.showModal();
}
$('#close-retail-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
function updateGuide(){
 if(kind!=='fashion')return;
 const data=model.sizeGuide({size:$('#detail-size').value});
 $('#size-guide').textContent=data?'Referência ilustrativa: tamanho '+data.size+',  '+data.reference+' cm de circunferência da peça. Não é recomendação individual de tamanho.':'Selecione uma opção válida.';
}
if(kind==='fashion'){
 $('#detail-size').addEventListener('change',updateGuide);
 function renderLook(){
  const block=$('#look-items');block.replaceChildren();
  for(const id of chosen){
    const item=model.fashion.find(x=>x.id===id);
    const row=el('div','selected-row');row.append(makeImage(item.photo,'Referência visual de '+item.name));
    const info=el('div');addText(info,'strong',item.name);addText(info,'span',money(item.price)+' · preço de referência');
    const remove=addText(row,'button','Remover');remove.type='button';remove.setAttribute('aria-label','Remover '+item.name);
    remove.addEventListener('click',()=>toggleLook(id));row.insertBefore(info,remove);block.append(row);
  }
  if(!chosen.length)addText(block,'p','Sua seleção aparecerá aqui.','placeholder');
  const total=model.outfit(chosen);
  $('#look-count').textContent=chosen.length+' de 3 peças';
  $('#look-total').textContent=money(total.total);
  renderCatalog();
 }
 toggleLook=function(id){
   if(chosen.includes(id))chosen=chosen.filter(x=>x!==id);
   else if(chosen.length<3)chosen=[...chosen,id];
   else{announce('Limite de três peças. Remova uma seleção para adicionar outra.');return;}
   renderLook();
 };
 $('#clear-look').addEventListener('click',()=>{chosen=[];renderLook();});
 $('#detail-action').addEventListener('click',()=>{if(!current)return;toggleLook(current.id);dialog.close();$('#experiencia').scrollIntoView({behavior:'smooth'});});
 renderLook();
}else{
 const listEl=$('#quote-items');
 function quoteUpdate(){
  const calc=model.quote(quote);
  listEl.replaceChildren();
  for(const line of quote){
   const item=model.materials.find(x=>x.id===line.id);
   const row=el('div','quote-row');const info=el('div');addText(info,'strong',item.name);addText(info,'span',money(item.price)+' / '+item.unit);
   const qLabel=el('label');addText(qLabel,'span','Quantidade');
   const qty=el('input');qty.type='number';qty.min='1';qty.max='500';qty.step='1';qty.value=String(line.quantity);qty.setAttribute('aria-label','Quantidade de '+item.name);
   qty.addEventListener('change',()=>{const n=Number(qty.value);if(!Number.isInteger(n)||n<1||n>500){qty.value=String(line.quantity);announce('Use uma quantidade de 1 a 500.');return;}quote=quote.map(l=>l.id===line.id?{id:l.id,quantity:n}:l);quoteUpdate();});
   qLabel.append(qty);const remove=addText(row,'button','Remover');remove.type='button';remove.setAttribute('aria-label','Remover '+item.name);remove.addEventListener('click',()=>{quote=quote.filter(l=>l.id!==line.id);quoteUpdate();});
   row.insertBefore(info,remove);row.insertBefore(qLabel,remove);listEl.append(row);
  }
  if(!quote.length)addText(listEl,'p','Inclua produtos do catálogo ou quantidades das calculadoras.','placeholder');
  $('#quote-count').textContent=quote.length===1?'1 item':quote.length+' itens';
  $('#quote-total').textContent=money(calc.total);
  $('#copy-quote').disabled=quote.length===0;
 }
 addQuote=function(id,q){
  if(!Number.isInteger(q)||q<1||q>500){announce('Quantidade deve ficar entre 1 e 500.');return;}
  const old=quote.find(l=>l.id===id);
  if(old&&old.quantity+q>500){announce('Limite de 500 unidades por item.');return;}
  quote=old?quote.map(l=>l.id===id?{id,quantity:l.quantity+q}:l):[...quote,{id,quantity:q}];
  quoteUpdate();announce('Item incluído na lista de referência.');
 };
 $('#detail-action').addEventListener('click',()=>{
  const n=Number($('#detail-qty').value);if(!current)return;
  if(!Number.isInteger(n)||n<1||n>500){announce('Quantidade entre 1 e 500.');return;}
  addQuote(current.id,n);dialog.close();$('#experiencia').scrollIntoView({behavior:'smooth'});
 });
 $('#clear-quote').addEventListener('click',()=>{quote=[];quoteUpdate();});
 $('#copy-quote').addEventListener('click',async()=>{
  const t=model.quote(quote);if(!t||!quote.length)return;
  const content=['BASE NORTE — LISTA DE REFERÊNCIA / USBRIN','Itens e preços meramente ilustrativos. Não é orçamento.'];
  for(const line of quote){const p=model.materials.find(v=>v.id===line.id);content.push(p.name+' — '+line.quantity+' × '+money(p.price)+' / '+p.unit);}
  content.push('Total ilustrativo: '+money(t.total));
  try{await navigator.clipboard.writeText(content.join('\n'));announce('Resumo ilustrativo copiado.');}
  catch{announce('Cópia automática indisponível neste navegador.');}
 });
 const floorFields=['#floor-area','#floor-loss','#floor-box'].map($);
 const paintFields=['#paint-area','#paint-coats','#paint-yield'].map($);
 let floor=null,paint=null;
 function updateFloor(){
  const [area,loss,boxCoverage]=floorFields.map(e=>e.value.trim()===''?NaN:Number(e.value));
  floor=model.calculateFloor({area,loss,boxCoverage});
  $('#floor-result').replaceChildren();
  if(!floor){addText($('#floor-result'),'p','Confira a área (1–500 m²), perdas (0–25%) e a cobertura por caixa (maior que 0, até 10 m²).');$('#apply-floor').disabled=true;return;}
  addText($('#floor-result'),'span','Necessidade com perdas:');
  addText($('#floor-result'),'strong',floor.effective.toLocaleString('pt-BR',{maximumFractionDigits:2})+' m²');
  addText($('#floor-result'),'span',floor.boxes+' caixas hipotéticas de '+boxCoverage+' m² (cobertura total: '+floor.coverage+' m²).');
  $('#apply-floor').disabled=false;
 }
 function updatePaint(){
  const [area,coats,yieldM2PerLiter]=paintFields.map(e=>e.value.trim()===''?NaN:Number(e.value));
  paint=model.calculatePaint({area,coats,yieldM2PerLiter,canLiters:18});
  $('#paint-result').replaceChildren();
  if(!paint){addText($('#paint-result'),'p','Confira a área (1–1000 m²), demãos (1–4) e rendimento (1–20 m²/L/demão).');$('#apply-paint').disabled=true;return;}
  addText($('#paint-result'),'span','Consumo estimado:');
  addText($('#paint-result'),'strong',paint.liters.toLocaleString('pt-BR')+' litros');
  addText($('#paint-result'),'span',paint.cans+' latas hipotéticas de 18 L.');
  $('#apply-paint').disabled=false;
 }
 [...floorFields,...paintFields].forEach(control=>control.addEventListener('input',()=>{updateFloor();updatePaint();}));
 const toolButtons=all('[data-tool]');
 toolButtons.forEach(button=>button.addEventListener('click',()=>{
  const selected=button.dataset.tool;toolButtons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  $('#floor-tool').hidden=selected!=='floor';$('#paint-tool').hidden=selected!=='paint';
 }));
 $('#apply-floor').addEventListener('click',()=>{if(floor)addQuote('m01',Math.ceil(floor.effective));});
 $('#apply-paint').addEventListener('click',()=>{if(paint)addQuote('m03',paint.cans);});
 quoteUpdate();updateFloor();updatePaint();
}
search.addEventListener('input',renderCatalog);
sorter.addEventListener('change',()=>{sort=sorter.value;renderCatalog();});
renderFilters();renderCatalog();
});
