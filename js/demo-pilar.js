/* Pilar Engenharia — interações demonstrativas sem transmissão de dados. */
document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const engine=window.USBRINPro;
  if(!engine)return;
  const $=selector=>document.querySelector(selector);
  const all=selector=>[...document.querySelectorAll(selector)];
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(value);
  const menu=$('.nav-toggle'),nav=$('#main-nav');
  if(menu&&nav){
    const close=()=>{nav.classList.remove('open');menu.textContent='Menu';menu.setAttribute('aria-expanded','false');};
    menu.addEventListener('click',()=>{const opened=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(opened));menu.textContent=opened?'Fechar':'Menu';});
    nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',close));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){close();menu.focus();}});
  }
  const categories=all('[data-project-filter]'), cards=all('[data-project-category]');
  categories.forEach(button=>button.addEventListener('click',()=>{
    categories.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    const selected=button.dataset.projectFilter;
    let visible=0;
    cards.forEach(card=>{card.hidden=selected!=='Todos'&&card.dataset.projectCategory!==selected;if(!card.hidden)visible++;});
    $('#project-count').textContent=visible===1?'1 estudo disponível':visible+' estudos disponíveis';
  }));
  const dialog=$('#project-dialog');
  all('[data-project-open]').forEach(button=>button.addEventListener('click',()=>{
    const item=engine.projects.find(project=>project.id===button.dataset.projectOpen);if(!item)return;
    $('#dialog-image').src=item.image;
    $('#dialog-image').alt='Ilustração conceitual de '+item.name;
    $('#dialog-type').textContent=item.category.toUpperCase()+' / '+item.location.toUpperCase();
    $('#dialog-title').textContent=item.name;
    $('#dialog-description').textContent=item.summary;
    $('#dialog-area').textContent=item.area.toLocaleString('pt-BR')+' m²';
    $('#dialog-phase').textContent=item.phase;
    $('#dialog-discipline').textContent=item.discipline;
    const list=$('#dialog-points');list.replaceChildren();
    item.points.forEach(point=>{const li=document.createElement('li');li.textContent=point;list.append(li);});
    dialog.showModal();
  }));
  $('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});

  const phases=[
    {title:'Leitura do contexto',copy:'Organização do briefing, escopo e objetivos antes de qualquer representação de solução.',output:'Mapa de requisitos e premissas'},
    {title:'Concepção orientada',copy:'Estudos visuais de alternativas para comunicar escolhas e organização espacial.',output:'Estudos de implantação e solução'},
    {title:'Integração de disciplinas',copy:'Apresentação de interfaces e conferência ilustrativa de interferências e revisões.',output:'Registro de compatibilização'},
    {title:'Entrega organizada',copy:'Estrutura de revisão, fichas, apresentações e histórico de documentos, sem simular obra real.',output:'Pacote demonstrativo de documentação'}
  ];
  all('[data-phase]').forEach(button=>button.addEventListener('click',()=>{
    const index=Number(button.dataset.phase);const info=phases[index];if(!info)return;
    all('[data-phase]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
    $('#phase-code').textContent='ETAPA 0'+(index+1)+' / 04';
    $('#phase-title').textContent=info.title;
    $('#phase-copy').textContent=info.copy;
    $('#phase-output').textContent=info.output;
    all('#phase-nodes circle').forEach((node,i)=>node.classList.toggle('active-node',i===index));
  }));

  const form=$('#lab-form'),area=$('#lab-area'),category=$('#lab-category'),complexity=$('#lab-complexity');
  function updateLab(){
    const value=Number(area.value);
    $('#lab-area-value').textContent=value+' m²';
    const result=engine.estimateConstruction({area:value,category:category.value,complexity:complexity.value});
    if(!result)return;
    $('#lab-range').textContent=money(result.low)+' – '+money(result.high);
    $('#value-reference').textContent=money(result.base);
    $('#value-low').textContent=money(result.low);
    $('#value-high').textContent=money(result.high);
    $('#lab-unit').textContent=money(result.unitCost)+'/m²';
    $('#lab-reserve').textContent=money(result.reserve);
    const maximum=result.high*1.04;
    [['#bar-reference',result.base],['#bar-low',result.low],['#bar-high',result.high]].forEach(([sel,num])=>{$(sel).style.width=Math.min(100,100*num/maximum)+'%';});
  }
  [area,category,complexity].forEach(control=>control.addEventListener('input',updateLab));
  form.addEventListener('reset',()=>requestAnimationFrame(updateLab));
  updateLab();
});
