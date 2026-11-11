/* USBRIN Experiences — simulações de hotelaria e serviços automotivos, sem operações reais. */
document.addEventListener('DOMContentLoaded',()=>{
'use strict';
const model=window.USBRINExperiences;if(!model)return;
const $=s=>document.querySelector(s);
const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
const type=document.body.dataset.experience,nav=$('#experience-nav'),navToggle=$('.nav-toggle');
if(nav&&navToggle){
 const close=()=>{nav.classList.remove('open');navToggle.setAttribute('aria-expanded','false');navToggle.textContent='Menu';};
 navToggle.addEventListener('click',()=>{const opened=nav.classList.toggle('open');navToggle.setAttribute('aria-expanded',String(opened));navToggle.textContent=opened?'Fechar':'Menu';});
 nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',close));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){close();navToggle.focus();}});
}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function image(src,alt){const img=el('img');img.src=src;img.alt=alt;img.loading='lazy';img.decoding='async';img.width=1200;img.height=900;img.addEventListener('error',()=>{img.alt='Fotografia de referência não carregada';img.style.opacity='.17';},{once:true});return img;}
if(type==='hotel'){
 let selected='classic';
 const cards=$('#room-grid'),options=$('#room-options'),arrival=$('#hotel-arrival'),departure=$('#hotel-departure'),guests=$('#hotel-guests'),breakfast=$('#hotel-breakfast');
 const toDate=days=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
 arrival.min=toDate(0);departure.min=toDate(1);arrival.value=toDate(14);departure.value=toDate(17);
 function choose(id,scroll){
  if(!model.rooms.some(room=>room.id===id))return;
  selected=id;
  options.querySelectorAll('[data-room]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.room===id)));
  cards.querySelectorAll('[data-room-card]').forEach(card=>card.dataset.selected=String(card.dataset.roomCard===id));
  update();
  if(scroll)$('#planejar').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
 }
 for(const [i,room] of model.rooms.entries()){
  const article=el('article','room-card');article.dataset.roomCard=room.id;article.dataset.selected=String(room.id===selected);
  const media=el('div','room-photo');media.append(image(room.photo,'Fotografia editorial de acomodação: '+room.name));
  const content=el('div','room-content');content.append(el('span','room-category','ACOMODAÇÃO / 0'+(i+1)),el('h3',null,room.name),el('p',null,room.subtitle));
  const stats=el('div','room-stats');stats.append(el('span',null,room.area+' m² ilustrativos'),el('span',null,'Até '+room.guests+' hóspedes'));content.append(stats);
  const list=el('ul');room.features.forEach(feature=>list.append(el('li',null,feature)));content.append(list);
  const bottom=el('div','room-bottom'),rate=el('strong','room-rate',money(room.night));rate.append(el('small',null,'por noite · hipotético'));
  const button=el('button',null,'Selecionar suíte ↗');button.type='button';button.dataset.selectRoom=room.id;button.addEventListener('click',()=>choose(room.id,true));
  bottom.append(rate,button);content.append(bottom);article.append(media,content);cards.append(article);
  const option=el('button','room-select-button');option.type='button';option.dataset.room=room.id;option.setAttribute('aria-pressed',String(room.id===selected));option.append(el('span',null,room.name),el('small',null,money(room.night)+'/noite · até '+room.guests+' hóspedes'));option.addEventListener('click',()=>choose(room.id,false));options.append(option);
 }
 function update(){
  const result=model.lodging({roomId:selected,arrival:arrival.value,departure:departure.value,guests:Number(guests.value),breakfast:breakfast.checked});
  const room=model.rooms.find(x=>x.id===selected);
  $('#hotel-room-label').textContent=room.name;
  const valid=$('#hotel-valid'),error=$('#hotel-error');
  valid.hidden=!result;error.hidden=!!result;
  if(!result)return;
  $('#hotel-nights').textContent=result.nights+(result.nights===1?' noite':' noites');
  $('#hotel-guest-label').textContent=result.guests+(result.guests===1?' hóspede':' hóspedes');
  $('#hotel-base').textContent=money(result.base);$('#hotel-breakfast-label').textContent=money(result.supplement);$('#hotel-total').textContent=money(result.total);
 }
 for(const field of [arrival,departure,guests,breakfast])field.addEventListener('change',update);
 arrival.addEventListener('change',()=>{departure.min=arrival.value||toDate(1);update();});
 $('#hotel-form').addEventListener('submit',event=>event.preventDefault());
 update();
}
if(type==='auto'){
 let selected='express';
 const list=$('#service-grid'),buttons=$('#service-options'),extras=$('#auto-extras'),form=$('#auto-form');
 function select(id,scroll){
  if(!model.services.some(x=>x.id===id))return;
  selected=id;buttons.querySelectorAll('[data-service]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.service===id)));
  update();
  if(scroll)$('#configurar').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
 }
 for(const [i,service] of model.services.entries()){
  const card=el('article','service-card');card.append(el('span','service-number','MÓDULO / 0'+(i+1)),el('h3',null,service.name),el('p',null,service.desc));
  const features=el('ul');service.includes.forEach(text=>features.append(el('li',null,text)));card.append(features);
  const btn=el('button','button', 'Explorar serviço ↗');btn.type='button';btn.dataset.cardService=service.id;btn.addEventListener('click',()=>select(service.id,true));card.append(btn);list.append(card);
  const option=el('button','service-choice');option.type='button';option.dataset.service=service.id;option.setAttribute('aria-pressed',String(selected===service.id));option.append(el('span',null,service.name),el('small',null,'Base '+money(service.price)));option.addEventListener('click',()=>select(service.id,false));buttons.append(option);
 }
 for(const extra of model.extras){
  const label=el('label','extra-item'),left=el('span'),input=el('input');
  input.type='checkbox';input.value=extra.id;input.dataset.extra=extra.id;left.append(input,el('span',null,extra.name));label.append(left,el('small',null,'+'+money(extra.price)+' · exemplo'));extras.append(label);
  input.addEventListener('change',update);
 }
 function currentInputs(){
  const size=form.querySelector('input[name="vehicle-size"]:checked')?.value||'sedan';
  const selectedExtras=[...form.querySelectorAll('[data-extra]:checked')].map(e=>e.value);
  return {serviceId:selected,size,selectedExtras};
 }
 function update(){
  const result=model.automobile(currentInputs());if(!result)return;
  $('#auto-package-title').textContent=result.name;
  $('#auto-price-base').textContent=money(result.base);
  $('#auto-price-extras').textContent=money(result.extras);
  $('#auto-duration').textContent='aprox. '+result.hours+' h (hipotéticas)';
  $('#auto-price-total').textContent=money(result.total);
  const selectedTexts=currentInputs().selectedExtras.map(id=>model.extras.find(x=>x.id===id)?.name).filter(Boolean);
  $('#auto-breakdown').textContent=result.extrasCount?'Complementos selecionados: '+selectedTexts.join(', ')+'.':'Nenhum complemento selecionado.';
 }
 form.querySelectorAll('input[name="vehicle-size"]').forEach(input=>input.addEventListener('change',update));
 form.addEventListener('submit',event=>event.preventDefault());
 $('#auto-copy').addEventListener('click',async()=>{
  const data=model.automobile(currentInputs());if(!data)return;
  const text=['MOTOR & FORMA — COMPOSIÇÃO ILUSTRATIVA',data.name,'Porte: '+data.size,'Base: '+money(data.base),'Complementos: '+money(data.extras),'Total hipotético: '+money(data.total),'Tempo exemplificativo: '+data.hours+' h','Não é orçamento, reserva ou serviço real.'].join('\n');
  try{
   if(!navigator.clipboard?.writeText)throw Error('Indisponível');
   await navigator.clipboard.writeText(text);$('#auto-copy-status').textContent='Resumo ilustrativo copiado.';
  }catch{$('#auto-copy-status').textContent='Cópia automática indisponível neste navegador. O resumo permanece visível na página.';}
 });
 update();
}
});
