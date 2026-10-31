'use strict';
document.addEventListener('DOMContentLoaded',()=>{
  const P=window.USBRIN_PRICING;
  if(!P){document.getElementById('quote-status').textContent='O configurador não carregou. Fale com a USBRIN pelo WhatsApp.';return;}
  const $=id=>document.getElementById(id);
  const form=$('studio-form'),pages=$('pages'),estimate=$('estimate'),lines=$('quote-lines');
  const quoteStatus=$('quote-status'),status=$('status'),result=$('message-result'),messagePreview=$('message-preview');
  const allowedReferences=['Clínica','Restaurante','Construtora','Imobiliária'],storageKey='usbrin-studio-config-v1';
  const refMap={clinica:'Clínica',restaurante:'Restaurante',construtora:'Construtora',imobiliaria:'Imobiliária'};
  const previewTitles={
    'Saúde':'Sua clínica merece uma presença acolhedora.',
    'Alimentação':'Uma experiência especial começa aqui.',
    'Construção':'Projetos que inspiram confiança.',
    'Imobiliário':'Seu próximo imóvel começa aqui.',
    'Serviços profissionais':'Profissionalismo em cada detalhe.',
    'Comércio':'Apresente o melhor do seu negócio.',
    'Outro':'Um site que representa seu negócio.'
  };
  let preparedMessage='',started=false;
  function track(name){
    // Eventos agregados, sem dados pessoais ou texto do briefing.
    if(Array.isArray(window.dataLayer))window.dataLayer.push({event:'usbrin_studio_'+name});
  }
  const checkboxValues=()=>[...form.querySelectorAll('input[name="feature"]:checked')].map(e=>e.value);
  const selectedStyle=()=>form.querySelector('input[name="style"]:checked')?.value||'moderno';
  const product=()=>form.querySelector('input[name="product"]:checked')?.value||'business';
  function capture(){
    return P.normalize({product:product(),pages:Number(pages.value),features:checkboxValues(),style:selectedStyle(),special:$('special').checked,largeCatalog:$('large-catalog').checked});
  }
  function persist(data){
    try{localStorage.setItem(storageKey,JSON.stringify({product:data.product,pages:data.pages,features:data.features,style:data.style,special:data.special,largeCatalog:data.largeCatalog,reference:allowedReferences.includes($('reference').value)?$('reference').value:'',sector:$('business-sector').value,colorCount:$('color-count').value}));}catch(_){}
  }
  function readSaved(){try{return JSON.parse(localStorage.getItem(storageKey)||'null')}catch(_){return null}}
  function apply(data){
    const normalized=P.normalize(data);
    const choice=form.querySelector('input[name="product"][value="'+normalized.product+'"]');
    if(choice)choice.checked=true;
    updatePageOptions(normalized.pages);
    form.querySelectorAll('input[name="feature"]').forEach(input=>{input.checked=normalized.features.includes(input.value)});
    const style=form.querySelector('input[name="style"][value="'+normalized.style+'"]');
    if(style)style.checked=true;
    $('special').checked=normalized.special;
    $('large-catalog').checked=normalized.largeCatalog;
    if(data&&allowedReferences.includes(data.reference))$('reference').value=data.reference;
    const sectorOptions=[...$('business-sector').options].map(x=>x.value);
    if(data&&sectorOptions.includes(data.sector))$('business-sector').value=data.sector;
    $('color-count').value=data&&['2','3','4'].includes(String(data.colorCount))?String(data.colorCount):'3';
    updateConditional();
  }
  function updatePageOptions(value){
    const cfg=P.PRODUCTS[product()],prev=Number(value);
    pages.replaceChildren();
    for(let i=1;i<=cfg.maxPages;i++){
      const o=document.createElement('option');o.value=String(i);
      o.textContent=i===1?'1 página':i+' páginas';pages.append(o);
    }
    pages.value=Number.isInteger(prev)&&prev>=1&&prev<=cfg.maxPages?String(prev):String(cfg.pages);
    $('pages-help').textContent=product()==='landing'?'Uma página com até seis seções padrão.':product()==='catalogo'?'Até 20 itens de catálogo no escopo-base.':'Páginas padronizadas; layouts exclusivos exigem avaliação.';
  }
  function updateConditional(){
    const isCatalog=product()==='catalogo';
    $('large-catalog').closest('label').hidden=!isCatalog;
    if(!isCatalog)$('large-catalog').checked=false;
    $('special-notes-field').hidden=!$('special').checked&&!$('large-catalog').checked;
  }
  function renderLines(data){
    lines.replaceChildren();
    const pageLine=document.createElement('div');pageLine.className='quote-line';
    const p=document.createElement('span');p.textContent=data.pages===1?'1 página selecionada':data.pages+' páginas selecionadas';
    const v=document.createElement('b');v.textContent='';pageLine.append(p,v);lines.append(pageLine);
    for(const item of data.lineItems){
      const line=document.createElement('div');line.className='quote-line';
      const name=document.createElement('span'),price=document.createElement('b');
      name.textContent=item.label;price.textContent=item.amount?P.money(item.amount):'Incluso';
      line.append(name,price);lines.append(line);
    }
  }
  function renderPreview(data){
    const target=$('site-preview');target.dataset.style=data.style;
    const sector=$('business-sector').value;
    $('site-brand').textContent=($('company').value.trim().slice(0,24)||'Sua marca.')
    $('site-kicker').textContent=sector?sector.toUpperCase():'APRESENTAÇÃO PROFISSIONAL';
    $('site-title').textContent=previewTitles[sector]||(
      data.product==='landing'?'Seu serviço merece ser visto.':
      data.product==='catalogo'?'Produtos organizados, contato facilitado.':
      'Um site que representa seu negócio.');
    $('site-subtitle').textContent=data.product==='catalogo'?
      'Uma vitrine clara para apresentar produtos e facilitar pedidos.':
      data.product==='landing'?
      'Uma página objetiva para mostrar sua oferta e gerar contatos.':
      'Apresente seus serviços e facilite o primeiro contato com clientes.';
  }
  function render(){
    updateConditional();
    const data=P.calculate(capture());
    estimate.textContent=(data.reviewRequired?'A partir de ':'')+P.money(data.estimate);
    renderLines(data);renderPreview(data);
    $('manual-review').hidden=!data.reviewRequired;
    persist(data);
    return data;
  }
  function invalidate(){
    result.hidden=true;preparedMessage='';$('whatsapp-link').removeAttribute('href');
    $('email-link').href='mailto:usbrin.contato@gmail.com';
    messagePreview.textContent='';status.textContent='';
  }
  function configurationText(){
    const d=P.calculate(capture());
    const features=d.features.length?d.features.map(k=>P.FEATURES[k].label).join(', '):'Nenhuma selecionada';
    return [
      'USBRIN Studio — configuração preliminar',
      'Tipo de site: '+P.PRODUCTS[d.product].label,
      'Páginas: '+d.pages,
      'Estilo: '+d.style,
      'Segmento: '+($('business-sector').value||'A definir'),
      'Demonstração de referência: '+($('reference').value||'Nenhuma'),
      'Cores da marca: '+($('brand-colors').value.trim()||'A definir'),
      'Quantidade de cores principais: '+$('color-count').value,
      'Funcionalidades: '+features,
      'Funções especiais: '+(d.special?'Sim — análise individual':'Não'),
      'Catálogo com mais de 20 itens: '+(d.largeCatalog?'Sim — análise individual':'Não'),
      (d.special||d.largeCatalog)?'Descrição especial: '+($('special-notes').value.trim()||'A definir'):'',
      '',
      'Estimativa para escopo padrão: '+P.money(d.estimate),
      d.reviewRequired?'Atenção: necessidades especiais NÃO estão incluídas na estimativa.':'',
      'Valor preliminar, não vinculante; sujeito a proposta definitiva.',
      'Domínio, hospedagem, manutenção, conteúdo e custos de terceiros separados.'
    ].filter(Boolean).join('\n');
  }
  function fullMessage(){
    return [
      'Olá, USBRIN! Gostaria de solicitar uma proposta pelo USBRIN Studio.',
      '',
      'Nome: '+$('name').value.trim(),
      $('company').value.trim()?'Empresa: '+$('company').value.trim():'',
      'Objetivo: '+$('goal').value.trim(),
      $('notes').value.trim()?'Observações: '+$('notes').value.trim():'',
      '',
      configurationText(),
      '',
      'Por favor, analisem meu projeto e confirmem o escopo e a proposta definitiva.'
    ].filter(Boolean).join('\n');
  }
  async function copyText(content,where){
    try{
      if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
      await navigator.clipboard.writeText(content);
      where.textContent='Texto copiado com sucesso.';
    }catch(_){
      // Fallback local: selecionar o texto sem enviá-lo para serviços externos.
      const area=document.createElement('textarea');area.value=content;area.setAttribute('aria-label','Texto para copiar');
      area.style.position='fixed';area.style.top='0';area.style.left='0';area.style.opacity='0';
      document.body.append(area);area.select();
      try{if(document.execCommand('copy'))where.textContent='Texto copiado com sucesso.';else throw Error('copy failed');}
      catch(e){where.textContent='Cópia automática indisponível. Selecione e copie o texto do resumo.';}
      area.remove();
    }
  }
  function shareUrl(){
    const d=P.calculate(capture());
    const params=new URLSearchParams();
    params.set('tipo',d.product);params.set('paginas',String(d.pages));params.set('estilo',d.style);
    params.set('recursos',d.features.join(','));
    params.set('cores',$('color-count').value);
    if(d.special)params.set('especial','1');
    if(d.largeCatalog)params.set('catalogo-ampliado','1');
    if(allowedReferences.includes($('reference').value))params.set('demo',$('reference').value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
    return location.origin+location.pathname+'?'+params.toString();
  }
  function restoreFromUrl(){
    const query=new URLSearchParams(location.search);
    const hasConfig=['tipo','paginas','estilo','recursos','especial','catalogo-ampliado'].some(k=>query.has(k));
    if(hasConfig){
      const features=query.has('recursos')?query.get('recursos').split(','):['whatsapp'];
      const raw={product:query.get('tipo'),pages:query.get('paginas'),features,style:query.get('estilo'),special:query.get('especial')==='1',largeCatalog:query.get('catalogo-ampliado')==='1',colorCount:query.get('cores')};
      apply(raw);
    }else{
      const saved=readSaved();
      if(saved&&typeof saved==='object')apply(saved);
      else apply({product:'business',pages:5,features:['whatsapp'],style:'moderno'});
    }
    const slug=query.get('demo');
    if(Object.hasOwn(refMap,slug))$('reference').value=refMap[slug];
  }
  form.querySelectorAll('input[name="product"]').forEach(input=>input.addEventListener('change',()=>{
    updatePageOptions(P.PRODUCTS[product()].pages);if(!started){started=true;track('configuration_started');}render();invalidate();
  }));
  form.addEventListener('input',event=>{
    if(event.target.name==='product')return;
    if(!started){started=true;track('configuration_started');}
    render();invalidate();
  });
  form.addEventListener('change',event=>{
    if(event.target.name==='product')return;
    render();invalidate();
  });
  function setDevice(mobile){
    $('site-preview').classList.toggle('mobile',mobile);
    $('device-desktop').classList.toggle('active',!mobile);$('device-mobile').classList.toggle('active',mobile);
    $('device-desktop').setAttribute('aria-pressed',String(!mobile));
    $('device-mobile').setAttribute('aria-pressed',String(mobile));
  }
  $('device-desktop').addEventListener('click',()=>setDevice(false));
  $('device-mobile').addEventListener('click',()=>setDevice(true));
  $('reset-config').addEventListener('click',()=>{
    if(!window.confirm('Recomeçar? Suas escolhas desta página serão apagadas.'))return;
    try{localStorage.removeItem(storageKey)}catch(_){}
    form.reset();$('name').value='';$('company').value='';$('goal').value='';$('notes').value='';
    $('reference').value='';$('brand-colors').value='';$('business-sector').value='';
    $('special-notes').value='';$('color-count').value='3';updatePageOptions(5);render();invalidate();quoteStatus.textContent='Configuração reiniciada.';
    document.getElementById('modelos').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  });
  $('copy-config').addEventListener('click',()=>copyText(configurationText(),quoteStatus));
  $('share-config').addEventListener('click',()=>copyText(shareUrl(),quoteStatus));
  $('download-config').addEventListener('click',()=>{
    const blob=new Blob([configurationText()+'\n'],{type:'text/plain;charset=utf-8'});
    const href=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=href;link.download='usbrin-studio-configuracao.txt';document.body.append(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(href),1000);
    quoteStatus.textContent='Resumo preparado para download, sem nome ou briefing.';
  });
  function clearValidation(){for(const id of ['name','goal'])$(id).setCustomValidity('')}
  form.addEventListener('input',clearValidation);
  form.addEventListener('submit',event=>{
    event.preventDefault();clearValidation();
    if(!$('name').value.trim())$('name').setCustomValidity('Digite seu nome.');
    if(!$('goal').value.trim())$('goal').setCustomValidity('Descreva o objetivo do site.');
    if(!form.reportValidity()){status.textContent='Confira os campos obrigatórios para continuar.';return;}
    preparedMessage=fullMessage();
    messagePreview.textContent=preparedMessage;
    $('whatsapp-link').href='https://wa.me/5569992967459?text='+encodeURIComponent(preparedMessage);
    $('email-link').href='mailto:usbrin.contato@gmail.com?subject='+encodeURIComponent('Solicitação de proposta — USBRIN Studio')+'&body='+encodeURIComponent(preparedMessage);
    result.hidden=false;
    track('proposal_prepared');
    status.textContent='Mensagem preparada. Revise e escolha como deseja enviá-la.';
    result.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
  });
  $('copy-message').addEventListener('click',()=>{if(preparedMessage)copyText(preparedMessage,status)});
  $('whatsapp-link').addEventListener('click',()=>track('whatsapp_open_clicked'));
  $('email-link').addEventListener('click',()=>track('email_open_clicked'));
  restoreFromUrl();render();
});
