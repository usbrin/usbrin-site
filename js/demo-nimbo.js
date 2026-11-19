/* Nimbo — catálogo, comparador e configuração demonstrativos, sem rede ou checkout. */
document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const engine=window.USBRINPro;if(!engine)return;
  const $=selector=>document.querySelector(selector),all=selector=>[...document.querySelectorAll(selector)];
  const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n);
  const nav=$('#nimbo-nav'),toggle=$('.menu-toggle');
  if(nav&&toggle){
    const close=()=>{nav.classList.remove('open');toggle.textContent='Menu';toggle.setAttribute('aria-expanded','false');};
    toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Fechar':'Menu';});
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){close();toggle.focus();}});
  }

  let category='Todos';
  const search=$('#item-search'),cards=all('[data-item-id]'),filters=all('[data-filter]');
  function updateCatalog(){
    const ids=new Set(engine.filterItems(category,search.value).map(item=>item.id));let count=0;
    cards.forEach(card=>{card.hidden=!ids.has(card.dataset.itemId);if(!card.hidden)count++;});
    $('#catalog-count').textContent=count===1?'1 peça disponível':count+' peças disponíveis';
    $('#empty').hidden=count>0;
  }
  filters.forEach(button=>button.addEventListener('click',()=>{category=button.dataset.filter;filters.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));updateCatalog();}));
  search.addEventListener('input',updateCatalog);

  let selection=[];
  const compareButtons=all('[data-compare]'),openCompare=$('#open-compare'),clearCompare=$('#clear-compare'),compareDialog=$('#compare-dialog');
  function drawComparison(){
    compareButtons.forEach(button=>{const selected=selection.includes(button.dataset.compare);button.setAttribute('aria-pressed',String(selected));button.textContent=selected?'Selecionado ✓':'Comparar +';});
    const names=selection.map(id=>engine.items.find(item=>item.id===id)?.name).filter(Boolean);
    $('#comparison-description').textContent=selection.length===0?'Selecione até duas peças para comparar especificações.':selection.length===1?names[0]+' selecionada · escolha mais uma peça.':names.join(' × ')+' · prontas para comparação.';
    openCompare.disabled=selection.length!==2;
    clearCompare.disabled=selection.length===0;
  }
  compareButtons.forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.compare;
    if(selection.includes(id))selection=selection.filter(value=>value!==id);
    else if(selection.length<2)selection.push(id);
    else {$('#comparison-description').textContent='Limite de duas peças. Remova uma seleção para adicionar outra.';return;}
    drawComparison();
  }));
  clearCompare.addEventListener('click',()=>{selection=[];drawComparison();});
  openCompare.addEventListener('click',()=>{
    if(selection.length!==2)return;
    const grid=$('#compare-grid');grid.replaceChildren();
    for(const id of selection){
      const item=engine.items.find(i=>i.id===id);if(!item)continue;
      const article=document.createElement('article');article.className='compare-item';
      const image=document.createElement('img');image.src=item.image;image.alt='Ilustração da peça '+item.name;image.width=900;image.height=620;
      const heading=document.createElement('h3');heading.textContent=item.name;
      const dl=document.createElement('dl');
      for(const [label,value] of [['Ambiente',item.category],['Categoria',item.type],['Largura-base ilustrativa',item.width+' cm'],['Valor-base hipotético',money(item.base)]]){
        const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
        dt.textContent=label;dd.textContent=value;row.append(dt,dd);dl.append(row);
      }
      article.append(image,heading,dl);grid.append(article);
    }
    compareDialog.showModal();
  });
  $('#compare-close').addEventListener('click',()=>compareDialog.close());
  compareDialog.addEventListener('click',event=>{if(event.target===compareDialog)compareDialog.close();});

  const product=$('#config-product'),width=$('#config-width'),hardware=$('#config-hardware'),finishes=all('[data-finish]');
  let finish='carvalho';
  function updatePreview(){
    const item=engine.items.find(i=>i.id===product.value);
    if(!item)return;
    const config={id:item.id,width:Number(width.value),finish,premiumHardware:hardware.checked};
    const result=engine.estimateFurniture(config);
    if(!result)return;
    $('#width-value').textContent=config.width+' cm';
    $('#preview-image').src=item.image;
    $('#preview-image').alt='Visualização ilustrativa da peça '+item.name+', sem atualização física do acabamento';
    $('#preview-model').textContent=item.name.toLocaleUpperCase('pt-BR');
    $('#preview-cost').textContent=money(result.value);
    $('#preview-summary').textContent=config.width+' cm · '+result.finish+(hardware.checked?' · Ferragens especiais':'');
    $('#preview-swatch').className='finish-indicator '+finish;
  }
  product.addEventListener('change',()=>{
    const item=engine.items.find(i=>i.id===product.value);
    if(item)width.value=String(item.width);
    updatePreview();
  });
  width.addEventListener('input',updatePreview);
  hardware.addEventListener('change',updatePreview);
  finishes.forEach(button=>button.addEventListener('click',()=>{
    finish=button.dataset.finish;finishes.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));updatePreview();
  }));
  all('[data-customize]').forEach(button=>button.addEventListener('click',()=>{
    const item=engine.items.find(i=>i.id===button.dataset.customize);if(!item)return;
    product.value=item.id;width.value=String(item.width);updatePreview();
    $('#configurador').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
    product.focus({preventScroll:true});
  }));
  $('#config-form').addEventListener('reset',()=>{
    finish='carvalho';finishes.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.finish===finish)));
    requestAnimationFrame(()=>{const item=engine.items.find(i=>i.id===product.value);if(item)width.value=String(item.width);updatePreview();});
  });
  drawComparison();updateCatalog();updatePreview();
});
