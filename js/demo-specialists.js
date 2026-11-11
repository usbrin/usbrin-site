/* USBRIN Specialists — interfaces sem backend, coleta de dados ou solicitações automáticas. */
document.addEventListener('DOMContentLoaded',()=>{
'use strict';
const api=window.USBRINSpecialists;if(!api)return;
const $=q=>document.querySelector(q);
const mode=document.body.dataset.specialist;
const nav=$('#specialist-nav'),menu=$('.nav-toggle');
if(nav&&menu){
 const close=()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='Menu';};
 menu.addEventListener('click',()=>{const opened=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(opened));menu.textContent=opened?'Fechar':'Menu';});
 nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){close();menu.focus();}});
}
const elt=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e;};
const image=(url,alt)=>{const img=elt('img');img.src=url;img.alt=alt;img.loading='lazy';img.decoding='async';img.width=1200;img.height=900;img.addEventListener('error',()=>{img.style.opacity='.2';img.alt='Fotografia editorial indisponível';},{once:true});return img;};
const moveTo=id=>{const e=$(id);if(e)e.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
async function copyText(text,status){
 try{
  if(!navigator.clipboard?.writeText)throw Error('Indisponível');
  await navigator.clipboard.writeText(text);
  status.textContent='Texto demonstrativo copiado.';
 }catch{status.textContent='Cópia automática indisponível neste navegador. Revise o texto mostrado na página.';}
}
if(mode==='cabinetry'){
 const rooms=$('#vereda-rooms'),roomChoices=$('#room-choices'),finishChoices=$('#finish-choices'),layoutChoices=$('#layout-choices');
 const width=$('#vereda-width'),height=$('#vereda-height'),notes=$('#vereda-notes'),copy=$('#vereda-copy'),status=$('#vereda-copy-status');
 const defaults={room:'cozinha',finish:'madeira',layout:'linear',width:3.2,height:2.5,notes:''};
 let room=defaults.room,finish=defaults.finish,layout=defaults.layout;
 function inputs(){return {room,finish,layout,width:width.value.trim()?Number(width.value):NaN,height:height.value.trim()?Number(height.value):NaN,notes:notes.value};}
 function mark(){roomChoices.querySelectorAll('[data-room]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.room===room)));
 finishChoices.querySelectorAll('[data-finish]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.finish===finish)));
 layoutChoices.querySelectorAll('[data-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===layout)));}
 function render(){
  const r=api.cabinetry(inputs()),rRoom=api.pick(room,api.rooms),rFinish=api.pick(finish,api.finishes);
  if(rRoom){
   $('#vereda-selected-photo').src=rRoom.photo;
   $('#vereda-selected-photo').alt='Fotografia editorial de '+rRoom.name+' usada somente como inspiração, não renderização da configuração';
   $('#vereda-summary-room').textContent=rRoom.name;
  }
  $('#vereda-summary-finish').textContent=rFinish?.name||'—';
  $('#vereda-color-dot').style.backgroundColor=rFinish?.code||'#ad8a69';
  $('#vereda-summary-detail').textContent=(rRoom?.subtitle||'')+' '+(api.pick(layout,api.layouts)?.info||'');
  $('#vereda-error').hidden=!!r;
  $('#vereda-dimensions').textContent=r?r.dimensions.width.toLocaleString('pt-BR')+' m × '+r.dimensions.height.toLocaleString('pt-BR')+' m · medidas aproximadas':'Confira as medidas antes de copiar.';
  copy.disabled=!r;mark();
 }
 function setRoom(id,scroll){
  if(!api.pick(id,api.rooms))return;room=id;render();if(scroll)moveTo('#configurador');
 }
 for(const [i,item] of api.rooms.entries()){
  const card=elt('article','vereda-room');const photo=image(item.photo,'Fotografia editorial de '+item.name+', não de obra executada pela marca');
  const body=elt('div','card-body');body.append(elt('span',null,'AMBIENTE / 0'+(i+1)),elt('h3',null,item.name),elt('p',null,item.subtitle));
  const btn=elt('button',null,'Planejar este ambiente ↗');btn.type='button';btn.dataset.planRoom=item.id;btn.addEventListener('click',()=>setRoom(item.id,true));
  body.append(btn);card.append(photo,body);rooms.append(card);
  const option=elt('button','choice',item.name);option.type='button';option.dataset.room=item.id;option.addEventListener('click',()=>setRoom(item.id,false));roomChoices.append(option);
 }
 for(const item of api.finishes){
  const btn=elt('button','finish-choice');btn.type='button';btn.dataset.finish=item.id;btn.append(elt('span','finish-swatch'));btn.lastChild.style.backgroundColor=item.code;
  btn.append(elt('span',null,item.name));btn.title=item.description;btn.addEventListener('click',()=>{finish=item.id;render();});finishChoices.append(btn);
 }
 for(const item of api.layouts){
  const btn=elt('button','layout-choice',item.name);btn.type='button';btn.dataset.layout=item.id;btn.title=item.info;
  btn.addEventListener('click',()=>{layout=item.id;render();});layoutChoices.append(btn);
 }
 for(const field of [width,height,notes])field.addEventListener('input',render);
 $('#vereda-form').addEventListener('submit',event=>event.preventDefault());
 copy.addEventListener('click',()=>{const brief=api.cabinetrySummary(inputs());if(brief)copyText(brief,status);});
 $('#vereda-reset').addEventListener('click',()=>{room=defaults.room;finish=defaults.finish;layout=defaults.layout;width.value=String(defaults.width);height.value=String(defaults.height);notes.value='';status.textContent='';render();});
 render();
}
if(mode==='dental'){
 const grid=$('#dental-specialties-grid'),specialty=$('#dental-specialty'),topic=$('#dental-topic'),shift=$('#dental-shift'),message=$('#dental-message'),status=$('#dental-copy-status');
 function render(){
  message.textContent=api.dentalMessage({specialty:specialty.value,topic:topic.value,shift:shift.value})||'Selecione opções válidas.';
 }
 for(const [i,s] of api.specialties.entries()){
  const card=elt('article','specialty-card'),photo=elt('div','specialty-photo');photo.append(image(s.photo,'Fotografia editorial de contexto odontológico: '+s.name));
  const content=elt('div','specialty-content');content.append(elt('span',null,'ÁREA / 0'+(i+1)),elt('h3',null,s.name),elt('p',null,s.description));
  const btn=elt('button',null,'Preparar contato ↗');btn.type='button';btn.dataset.specialty=s.id;
  btn.addEventListener('click',()=>{specialty.value=s.id;render();moveTo('#contato');});
  content.append(btn);card.append(photo,content);grid.append(card);
 }
 for(const field of [specialty,topic,shift])field.addEventListener('change',render);
 $('#dental-form').addEventListener('submit',event=>event.preventDefault());
 $('#dental-copy').addEventListener('click',()=>{const result=api.dentalMessage({specialty:specialty.value,topic:topic.value,shift:shift.value});if(result)copyText(result,status);});
 $('#dental-reset').addEventListener('click',()=>{specialty.value='clinica';topic.value='informacoes';shift.value='indiferente';status.textContent='';render();});
 render();
}
});
