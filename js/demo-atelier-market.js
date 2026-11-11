/* USBRIN Atelier / vitrines editoriais — sem checkout ou API.
   Curadoria de presentes e rotina cosmética são demonstrativos, sem recomendação individual.
 */
document.addEventListener('DOMContentLoaded',()=>{
'use strict';
const model=window.USBRINAtelier;if(!model)return;
const kind=document.body.dataset.atelier;if(!['jewelry','cosmetics'].includes(kind))return;
const $=selector=>document.querySelector(selector),all=selector=>[...document.querySelectorAll(selector)];
const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const productList=kind==='jewelry'?model.jewelry:model.cosmetics;
let category='Todos',sort='destaques',selected=[],texture='leve',choices={},current=null,toastTimer;
// Ações dos cartões devem acessar funções definidas nas duas experiências.
let drawComparison=()=>{},drawRoutine=()=>{};
const filters=$('#atelier-filters'),cards=$('#atelier-cards'),search=$('#atelier-search'),sortControl=$('#atelier-sort'),dialog=$('#atelier-dialog'),toast=$('#atelier-toast');
function node(tag,cls){const e=document.createElement(tag);if(cls)e.className=cls;return e;}
function text(parent,tag,value,cls){const e=node(tag,cls);e.textContent=value;parent.append(e);return e;}
function picture(src,alt){const img=node('img');img.src=src;img.alt=alt;img.loading='lazy';img.decoding='async';img.width=920;img.height=780;img.addEventListener('error',()=>{img.style.opacity='.22';img.alt='Fotografia de referência indisponível';},{once:true});return img;}
function notify(message){toast.hidden=false;toast.textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,2800);}
const nav=$('#atelier-nav'),toggle=$('.nav-toggle');
if(nav&&toggle){
 const close=()=>{toggle.textContent='Menu';toggle.setAttribute('aria-expanded','false');nav.classList.remove('open');};
 toggle.addEventListener('click',()=>{const opened=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(opened));toggle.textContent=opened?'Fechar':'Menu';});
 nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){close();toggle.focus();}});
}
function drawFilters(){
 filters.replaceChildren();
 for(const name of model.categories[kind]){
  const button=text(filters,'button',name);button.type='button';button.dataset.category=name;button.setAttribute('aria-pressed',String(category===name));
  button.addEventListener('click',()=>{category=name;drawFilters();drawCatalog();});
 }
}
function choose(id){
 if(kind==='jewelry'){if(selected.includes(id))selected=selected.filter(value=>value!==id);else if(selected.length<2)selected=[...selected,id];else{notify('Compare até duas peças. Remova uma antes de selecionar outra.');return;}drawComparison();}
 else{
  const p=model.cosmetics.find(x=>x.id===id);if(!p)return;
  choices[p.stage]=p.id;drawRoutine();
 }
 drawCatalog();
}
function showDetails(product){
 current=product;
 const img=$('#detail-photo');img.src=product.photo;img.alt='Fotografia editorial de referência para '+product.name;
 $('#detail-category').textContent=(product.category||product.stage)+' · projeto conceitual';
 $('#detail-title').textContent=product.name;
 $('#detail-description').textContent=product.detail;
 $('#detail-price').textContent=money(product.price)+' · valor demonstrativo';
 $('#detail-attribute').textContent=kind==='jewelry'?product.finish+' · composição e procedência não verificadas':product.format+' · fórmula e composição fictícias';
 dialog.showModal();
}
function drawCatalog(){
 const data=model.catalog(kind,category,search.value,sort);cards.replaceChildren();
 for(const product of data){
  const article=node('article','product');article.dataset.product=product.id;
  const media=node('button','product-photo');media.type='button';media.setAttribute('aria-label','Ver referência '+product.name);media.append(picture(product.photo,'Foto editorial de referência para '+product.name));text(media,'span','IMAGEM DE REFERÊNCIA','photo-tag');media.addEventListener('click',()=>showDetails(product));
  const copy=node('div','product-copy');
  text(copy,'span',product.category||product.stage);text(copy,'h3',product.name);text(copy,'p',product.detail);
  const price=text(copy,'strong',money(product.price),'product-price');text(price,'small','Valor ilustrativo · não comercial');
  const actions=node('div','product-actions');
  const detail=text(actions,'button','Ver detalhes');detail.type='button';detail.addEventListener('click',()=>showDetails(product));
  const pressed=kind==='jewelry'?selected.includes(product.id):choices[product.stage]===product.id;
  const select=text(actions,'button',pressed?'Selecionado ✓':kind==='jewelry'?'Comparar +':'Escolher etapa +','primary-action');
  select.type='button';select.dataset.choose=product.id;select.setAttribute('aria-pressed',String(pressed));select.addEventListener('click',()=>choose(product.id));
  copy.append(actions);article.append(media,copy);cards.append(article);
 }
 $('#catalog-count').textContent=data.length===1?'1 referência encontrada':data.length+' referências encontradas';
 $('#catalog-empty').hidden=data.length>0;
}
$('#dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
$('#detail-select').addEventListener('click',()=>{if(!current)return;const id=current.id;dialog.close();choose(id);$('#estudio').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});});
if(kind==='jewelry'){
 const wrap=$('#gift-wrap'),oc=$('#gift-occasion'),budget=$('#gift-budget');
 function drawFinder(){
  const results=model.giftFinder(oc.value,Number(budget.value));const container=$('#gift-results');container.replaceChildren();
  if(!results||!results.length){text(container,'p','Nenhum item neste cenário. Amplie o orçamento ou altere a ocasião.','finder-empty');}
  else for(const p of results){
   const row=node('article','finder-result');row.append(picture(p.photo,'Referência de '+p.name));
   const info=node('div');text(info,'h3',p.name);text(info,'small',p.category+' · '+p.presentation);
   text(row,'strong',money(p.price));row.insertBefore(info,row.lastChild);container.append(row);
  }
  $('#gift-count').textContent=(results?.length||0)+' opções de referência';
 }
 drawComparison=function(){
  const container=$('#comparison-items');container.replaceChildren();
  const result=model.comparison(selected,wrap.checked);
  for(const id of selected){
   const p=model.jewelry.find(x=>x.id===id);
   const row=node('article','comparison-item');row.append(picture(p.photo,'Referência de '+p.name));
   const content=node('div');text(content,'strong',p.name);text(content,'span',p.category+' · '+money(p.price));
   const remove=text(content,'button','Remover');remove.type='button';remove.setAttribute('aria-label','Remover '+p.name);remove.addEventListener('click',()=>choose(id));
   row.append(content);container.append(row);
  }
  if(!selected.length)text(container,'p','Selecione até duas peças do catálogo para comparar.','placeholder');
  $('#comparison-total').textContent=money(result.total);
  drawCatalog();
 };
 oc.addEventListener('change',drawFinder);budget.addEventListener('change',drawFinder);wrap.addEventListener('change',drawComparison);
 $('#comparison-clear').addEventListener('click',()=>{selected=[];wrap.checked=false;drawComparison();});
 drawFinder();drawComparison();
}else{
 drawRoutine=function(){
  const data=model.routine(texture,choices);
  if(!data)return;
  const container=$('#routine-steps');container.replaceChildren();
  data.steps.forEach((item,i)=>{
   const row=node('div','routine-step');text(row,'span',String(i+1).padStart(2,'0'));row.append(picture(item.photo,'Foto editorial de referência para '+item.name));
   const wrap=node('div');const label=text(wrap,'label',item.stage);const select=node('select');select.setAttribute('aria-label','Escolher produto para a etapa '+item.stage);
   select.dataset.stage=item.stage;const opts=model.cosmetics.filter(p=>p.stage===item.stage);
   for(const candidate of opts){const option=node('option');option.value=candidate.id;option.textContent=candidate.name;select.append(option);}
   select.value=item.id;
   select.addEventListener('change',()=>{choices[item.stage]=select.value;drawRoutine();drawCatalog();});
   label.append(select);text(wrap,'strong',money(item.price)+' · ilustrativo');row.append(wrap);container.append(row);
  });
  $('#routine-total').textContent=money(data.total);
  $('#routine-texture-label').textContent='TEXTURA '+(texture==='leve'?'LEVE':'CREMOSA').toUpperCase();
 };
 const controls=all('[data-texture]');
 controls.forEach(button=>button.addEventListener('click',()=>{texture=button.dataset.texture;choices={};controls.forEach(control=>control.setAttribute('aria-pressed',String(button===control)));drawRoutine();drawCatalog();}));
 $('#routine-reset').addEventListener('click',()=>{texture='leve';choices={};controls.forEach(control=>control.setAttribute('aria-pressed',String(control.dataset.texture===texture)));drawRoutine();drawCatalog();});
 drawRoutine();
}
search.addEventListener('input',drawCatalog);sortControl.addEventListener('change',()=>{sort=sortControl.value;drawCatalog();});
drawFilters();drawCatalog();
});
