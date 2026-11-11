'use strict';
/* Integridade UX do USBRIN Portfolio em Chromium. Executar após instalar Playwright. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const port=8013;
const type={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png',webp:'image/webp',svg:'image/svg+xml',ico:'image/x-icon',xml:'application/xml'};
const server=http.createServer((req,res)=>{
  let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(file.endsWith(path.sep))file=path.join(file,'index.html');
  try{const b=fs.readFileSync(file);res.writeHead(200,{'Content-Type':type[path.extname(file).slice(1)]||'application/octet-stream'});res.end(b);}
  catch{res.writeHead(404);res.end('Not found');}
});
(async()=>{
 let browser,checks=0;const errors=[];const ok=(condition,message)=>{assert.ok(condition,message);checks++};
 try{
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',resp=>{if(resp.url().startsWith('http://127.0.0.1:'+port)&&resp.status()>=400)errors.push(resp.status()+' '+resp.url());});
  const base='http://127.0.0.1:'+port+'/';
  const demos=['portfolio.html','demo-restaurante.html','demo-construtora.html','demo-clinica.html','demo-imobiliaria.html','demo-pilar.html','demo-nimbo.html','demo-norte-contabil.html','demo-nexo-automacao.html','demo-volta-tech.html','demo-casa-patta.html','demo-lume-moda.html','demo-base-norte.html','demo-aurea-joias.html','demo-essencia-cosmeticos.html'];
  for(const width of [360,390,768,1366]){
    await page.setViewportSize({width,height:850});
    for(const filename of demos){
      await page.goto(base+filename,{waitUntil:'domcontentloaded'});
      ok(await page.locator('h1').count()===1,filename+' tem um h1 em '+width);
      ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),
        'Rolagem horizontal '+filename+' width='+width+' atual='+await page.evaluate(()=>document.documentElement.scrollWidth));
      ok(await page.locator('a[href="portfolio.html"]').count()>=1||filename==='portfolio.html','Retorno Portfolio em '+filename);
      if(filename.startsWith('demo-')){
        ok(await page.locator('img').count()>=(filename.includes('contabil')||filename.includes('automacao')?1:2),'Arte em '+filename);
        ok(await page.locator('[data-demo], [data-suite], [data-shop], [data-retail], [data-atelier]').count()===1,'Id da demonstração em '+filename);
      }
    }
  }
  await page.setViewportSize({width:1366,height:900});
  await page.goto(base+'portfolio.html');await page.locator('[data-filter="construcao"]').click();
  ok(await page.locator('.project:not([hidden])').count()===4,'Filtro construção na galeria');
  await page.locator('[data-filter="todos"]').click();
  await page.locator('#portfolio-search').fill('Vitta');
  ok(await page.locator('.project:not([hidden])').count()===1,'Busca de projeto');
  await page.locator('#portfolio-search').fill('');
  ok(await page.locator('.project:not([hidden])').count()===18,'Galeria mantém 18 projetos');

  await page.goto(base+'demo-restaurante.html');
  await page.locator('[data-menu-filter="sobremesas"]').click();
  ok(await page.locator('[data-menu-type="entradas"]').isHidden(),'Menu oculta entradas');
  await page.locator('[data-menu-filter="todos"]').click();
  ok(await page.locator('[data-menu-type="entradas"]').isVisible(),'Menu recupera entradas');
  await page.locator('[data-gallery-src]').first().click();
  ok(await page.locator('#gallery-dialog').isVisible(),'Galeria amplia arte');
  await page.locator('[data-close-dialog="gallery-dialog"]').click();
  await page.locator('[data-open-reservation]').first().click();
  await page.locator('[data-reserve-people="4"]').click();
  await page.locator('[data-reserve-place="Varanda"]').click();
  ok((await page.locator('#reservation-summary').innerText()).includes('4 pessoas'),'Resumo pessoas');
  ok((await page.locator('#reservation-summary').innerText()).includes('varanda'),'Resumo ambiente');
  await page.locator('[data-close-dialog="reservation-dialog"]').click();

  await page.goto(base+'demo-construtora.html');
  await page.locator('[data-work-filter="industrial"]').click();
  ok(await page.locator('.work-card:not([hidden])').count()===1,'Filtro industrial');
  await page.locator('[data-work-open="galpao"]').first().click();
  ok(await page.locator('#work-dialog').isVisible(),'Detalhe da obra');
  ok((await page.locator('#work-title').innerText()).includes('Galpão'),'Título da obra');
  await page.locator('[data-close-dialog="work-dialog"]').click();

  await page.goto(base+'demo-clinica.html');
  await page.locator('[data-spec-select="nutricao"]').click();
  ok((await page.locator('#specialty-title').innerText()).includes('hábitos'),'Seleção especialidade');
  await page.locator('[data-period="Tarde"]').click();
  ok((await page.locator('#journey-summary').innerText()).includes('Tarde'),'Preferência período');
  ok((await page.locator('#journey-summary').innerText()).includes('Nutrição'),'Preferência especialidade');

  await page.goto(base+'demo-imobiliaria.html');
  await page.locator('[data-prop-filter="casa"]').click();
  ok(await page.locator('.prop-card:not([hidden])').count()===1,'Filtro por casas');
  await page.locator('[data-property-open="casa"]').first().click();
  ok(await page.locator('#property-dialog').isVisible(),'Ficha do imóvel abre');
  ok((await page.locator('#property-title').innerText()).includes('Bosque'),'Nome do imóvel');
  await page.locator('[data-close-dialog="property-dialog"]').click();


  // Engenharia: navegação, detalhes e cálculo didático de estimativa.
  await page.goto(base+'demo-pilar.html');
  ok((await page.locator('#lab-range').innerText()).includes('R$'),'Laboratório exibe faixa em reais');
  const costPrior=await page.locator('#lab-range').innerText();
  await page.locator('#lab-area').evaluate(el=>{el.value='260';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#lab-category').selectOption('industrial');
  ok(await page.locator('#lab-range').innerText()!==costPrior,'Cenário de engenharia atualiza valores');
  await page.locator('[data-project-filter="Industrial"]').click();
  ok(await page.locator('.project-card:not([hidden])').count()===1,'Filtro técnico industrial');
  await page.locator('[data-project-open="logistico"]').first().click();
  ok(await page.locator('#project-dialog').isVisible(),'Ficha técnica aberta');
  ok((await page.locator('#dialog-title').innerText()).includes('Complexo Base'),'Ficha do estudo correto');
  await page.locator('[data-close]').click();
  await page.locator('[data-phase="2"]').click();
  ok((await page.locator('#phase-title').innerText()).includes('Integração'),'Etapa técnica atualizada');

  // Móveis: filtros e busca; comparação e configurador ilustrativos.
  await page.goto(base+'demo-nimbo.html');
  await page.locator('[data-filter="Quarto"]').click();
  ok(await page.locator('.item:not([hidden])').count()===2,'Filtro de peças para quarto');
  await page.locator('#item-search').fill('Casa');
  ok(await page.locator('.item:not([hidden])').count()===1,'Busca encontra peça');
  await page.locator('#item-search').fill('');
  await page.locator('[data-filter="Todos"]').click();
  await page.locator('[data-compare="n01"]').click();
  await page.locator('[data-compare="n03"]').click();
  ok(!(await page.locator('#open-compare').isDisabled()),'Comparação habilitada');
  await page.locator('#open-compare').click();
  ok(await page.locator('.compare-item').count()===2,'Duas fichas no comparador');
  await page.locator('#compare-close').click();
  const furniturePrior=await page.locator('#preview-cost').innerText();
  await page.locator('#config-width').evaluate(el=>{el.value='280';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('[data-finish="nogueira"]').click();
  await page.locator('#config-hardware').check();
  ok(await page.locator('#preview-cost').innerText()!==furniturePrior,'Estimativa de móveis atualizada');
  ok((await page.locator('#preview-summary').innerText()).includes('Nogueira'),'Resumo de acabamento atualizado');
  await page.locator('#config-product').selectOption('n03');
  ok((await page.locator('#preview-model').innerText()).includes('ORLA'),'Modelo escolhido sincronizado');

  // Norte: cenários e indicadores financeiros com campos editáveis.
  await page.goto(base+'demo-norte-contabil.html');
  ok((await page.locator('#finance-result').innerText()).includes('11.860'),'Resultado inicial do cenário base');
  await page.locator('[data-scenario="conservador"]').click();
  ok((await page.locator('#finance-result').innerText()).includes('1.180')&&(await page.locator('#finance-result').innerText()).includes('-'),'Cenário conservador apresenta déficit ilustrativo');
  await page.locator('#finance-revenue').fill('64000');
  ok((await page.locator('#result-title').innerText()).includes('personalizado'),'Edição marca cenário personalizado');
  await page.locator('#finance-variable').fill('150');
  ok(await page.locator('#finance-validation').isVisible(),'Valores inválidos indicados');
  await page.locator('#finance-form .reset-btn').click();
  ok(await page.locator('#finance-validation').isHidden(),'Restauração limpa validação');
  ok((await page.locator('#finance-result').innerText()).includes('11.860'),'Reset retorna ao cenário base');

  // Nexo: configuração funcional e simulação passo a passo.
  await page.goto(base+'demo-nexo-automacao.html');
  ok(await page.locator('#flow-nodes li').count()===4,'Fluxo apresenta quatro etapas');
  await page.locator('#flow-template').selectOption('operacoes');
  await page.locator('#flow-channel').selectOption('interno');
  await page.locator('[data-priority="alta"]').click();
  await page.locator('#flow-delay').evaluate(el=>{el.value='20';el.dispatchEvent(new Event('input',{bubbles:true}));});
  ok((await page.locator('#flow-heading').innerText()).includes('Operações'),'Modelo de fluxo atualizado');
  ok((await page.locator('#flow-nodes li').nth(1).innerText()).includes('Alta'),'Prioridade aplicada');
  for(let n=0;n<4;n++)await page.locator('#flow-next').click();
  ok(await page.locator('#flow-next').isDisabled(),'Execução finaliza após quatro etapas');
  ok(await page.locator('#flow-nodes li.completed').count()===4,'Todas as etapas marcadas como executadas');
  ok(await page.locator('#flow-log li').count()===4,'Log registra quatro eventos');
  await page.locator('#flow-restart').click();
  ok(await page.locator('#flow-nodes li.completed').count()===0,'Reinício limpa execução');

  // Nova geração de e-commerce: vitrines fotográficas, variações e sacola local.
  await page.goto(base+'demo-volta-tech.html');
  ok(await page.locator('.product-card').count()===6,'VOLTA apresenta seis produtos');
  await page.locator('[data-category="Áudio"]').click();
  ok(await page.locator('.product-card').count()===3,'VOLTA filtra áudio');
  await page.locator('#catalog-search').fill('Fone');
  ok(await page.locator('.product-card').count()===2,'VOLTA busca produtos');
  await page.locator('#catalog-search').fill('');
  await page.locator('[data-category="Todos"]').click();
  await page.locator('[data-view="t02"]').first().click();
  ok(await page.locator('#product-dialog').isVisible(),'VOLTA abre ficha de produto');
  await page.locator('#detail-variant').selectOption('Preto');
  await page.locator('#detail-quantity').fill('2');
  await page.locator('#detail-add').click();
  ok(await page.locator('#cart-dialog').isVisible(),'VOLTA abre sacola após escolher variação');
  ok((await page.locator('#cart-subtotal').innerText()).includes('498,00'),'Subtotal para duas unidades correto');
  ok((await page.locator('#cart-delivery').innerText()).includes('Grátis'),'Frete demonstrativo acima de limite');
  ok(await page.locator('.cart-line').count()===1,'VOLTA tem uma linha na sacola');
  await page.locator('.cart-line .decrement').click();
  ok((await page.locator('#cart-subtotal').innerText()).includes('249,00'),'Quantidade altera subtotal');
  ok((await page.locator('#cart-delivery').innerText()).includes('24,90'),'Taxa simulada abaixo do limite');
  ok(await page.locator('.button-disabled').isDisabled(),'Finalização real desativada na VOLTA');
  await page.locator('.cart-line .remove').click();
  ok(await page.locator('#cart-empty').isVisible(),'Remoção esvazia sacola');
  await page.locator('[data-close-cart]').click();

  await page.goto(base+'demo-casa-patta.html');
  ok(await page.locator('.product-card').count()===6,'Casa Patta apresenta seis produtos');
  await page.locator('[data-category="Passeio"]').click();
  ok(await page.locator('.product-card').count()===2,'Casa Patta filtra passeio');
  await page.locator('#catalog-search').fill('Coleira');
  ok(await page.locator('.product-card').count()===1,'Casa Patta encontra coleira');
  await page.locator('#catalog-search').fill('');
  await page.locator('[data-category="Todos"]').click();
  await page.locator('[data-add="p01"]').click();
  await page.locator('[data-open-cart]').click();
  ok((await page.locator('#cart-subtotal').innerText()).includes('89,00'),'Casa Patta adiciona primeiro produto');
  await page.locator('.cart-line .increment').click();
  ok((await page.locator('#cart-subtotal').innerText()).includes('178,00'),'Casa Patta atualiza quantidade');
  ok(await page.locator('.button-disabled').isDisabled(),'Casa Patta sem checkout real');
  await page.locator('[data-close-cart]').click();
  await page.locator('[data-view="p04"]').first().click();
  await page.locator('#detail-variant').selectOption('M');
  await page.locator('#detail-add').click();
  ok(await page.locator('.cart-line').count()===2,'Casa Patta reúne duas variações na sacola');
  ok((await page.locator('#cart-delivery').innerText()).includes('Grátis'),'Frete ilustrativo ao cruzar limite');
  await page.locator('[data-close-cart]').click();


  // Lume Moda — busca e editor de looks com até três peças.
  await page.goto(base+'demo-lume-moda.html');
  ok(await page.locator('.product-card').count()===6,'Lume exibe seis produtos');
  await page.locator('[data-category="Alfaiataria"]').click();
  ok(await page.locator('.product-card').count()===2,'Lume filtra alfaiataria');
  await page.locator('#retail-search').fill('Blazer');
  ok(await page.locator('.product-card').count()===1,'Lume pesquisa peças');
  await page.locator('#retail-search').fill('');
  await page.locator('[data-category="Todos"]').click();
  await page.locator('.product-card[data-product="f01"] .product-media').click();
  ok(await page.locator('#retail-dialog').isVisible(),'Lume abre detalhe');
  await page.locator('#detail-size').selectOption('G');
  ok((await page.locator('#size-guide').innerText()).includes('108 cm'),'Guia de tamanho reage');
  await page.locator('#detail-action').click();
  ok((await page.locator('#look-count').innerText()).includes('1 de 3'),'Look recebe primeira peça');
  await page.locator('[data-add="f02"]').click();
  await page.locator('[data-add="f03"]').click();
  ok((await page.locator('#look-count').innerText()).includes('3 de 3'),'Look recebe três peças');
  const lookBefore=await page.locator('#look-total').innerText();
  await page.locator('[data-add="f04"]').click();
  ok((await page.locator('#look-total').innerText())===lookBefore,'Limite de três peças é respeitado');
  await page.locator('#clear-look').click();
  ok((await page.locator('#look-total').innerText()).includes('0,00'),'Limpeza do look zera valor');

  // Base Norte — cálculo de revestimento, pintura e lista orientada a projeto.
  await page.goto(base+'demo-base-norte.html');
  ok(await page.locator('.product-card').count()===6,'Base Norte exibe seis materiais');
  await page.locator('[data-category="Revestimentos"]').click();
  ok(await page.locator('.product-card').count()===2,'Base Norte filtra revestimentos');
  await page.locator('#retail-search').fill('Mineral');
  ok(await page.locator('.product-card').count()===1,'Base Norte pesquisa material');
  await page.locator('#retail-search').fill('');
  await page.locator('[data-category="Todos"]').click();
  ok((await page.locator('#floor-result').innerText()).includes('20 caixas'),'Cálculo de caixas informativo');
  await page.locator('#apply-floor').click();
  ok((await page.locator('#quote-total').innerText()).includes('3.316,00'),'Lista inclui revestimento em m²');
  await page.locator('[data-tool="paint"]').click();
  ok(await page.locator('#paint-tool').isVisible(),'Aba de pintura selecionada');
  ok((await page.locator('#paint-result').innerText()).includes('9,6 litros'),'Cálculo de tinta correto');
  await page.locator('#apply-paint').click();
  ok((await page.locator('#quote-total').innerText()).includes('3.535,00'),'Lista combina materiais de categorias diferentes');
  ok(!(await page.locator('#copy-quote').isDisabled()),'Resumo da cotação disponível para copiar');
  await page.locator('#clear-quote').click();
  ok((await page.locator('#quote-total').innerText()).includes('0,00'),'Lista de cotação reiniciada');

  // Joalheria: curadoria transparente, catálogo e comparação de duas peças.
  await page.goto(base+'demo-aurea-joias.html');
  ok(await page.locator('.product').count()===6,'Áurea tem seis referências');
  await page.locator('[data-category="Colares"]').click();
  ok(await page.locator('.product').count()===2,'Áurea filtra colares');
  await page.locator('#atelier-search').fill('Aurora');
  ok(await page.locator('.product').count()===1,'Áurea pesquisa peças');
  await page.locator('#atelier-search').fill('');
  await page.locator('[data-category="Todos"]').click();
  await page.locator('#gift-occasion').selectOption('cotidiano');
  await page.locator('#gift-budget').selectOption('30000');
  ok((await page.locator('#gift-count').innerText()).includes('2 opções'),'Curadoria por ocasião e orçamento');
  await page.locator('.product[data-product="j01"] .product-photo').click();
  ok(await page.locator('#atelier-dialog').isVisible(),'Ficha de joia abre');
  await page.locator('#detail-select').click();
  await page.locator('[data-choose="j02"]').click();
  ok((await page.locator('#comparison-total').innerText()).includes('688,00'),'Comparação soma peças');
  await page.locator('#gift-wrap').check();
  ok((await page.locator('#comparison-total').innerText()).includes('717,00'),'Embalagem demonstrativa');
  await page.locator('#comparison-clear').click();
  ok((await page.locator('#comparison-total').innerText()).includes('0,00'),'Comparação pode ser zerada');

  // Cosméticos: seleções de preferência estética, sem diagnóstico clínico.
  await page.goto(base+'demo-essencia-cosmeticos.html');
  ok(await page.locator('.product').count()===6,'Essência apresenta seis conceitos');
  await page.locator('[data-category="Hidratar"]').click();
  ok(await page.locator('.product').count()===2,'Essência filtra etapa');
  await page.locator('[data-category="Todos"]').click();
  ok((await page.locator('#routine-total').innerText()).includes('277,00'),'Rotina leve tem valor ilustrativo correto');
  await page.locator('[data-texture="cremosa"]').click();
  ok((await page.locator('#routine-total').innerText()).includes('317,00'),'Textura cremosa reorganiza as três etapas');
  await page.locator('[data-stage="Hidratar"]').selectOption('c03');
  ok((await page.locator('#routine-total').innerText()).includes('297,00'),'Troca manual recalcula composição');
  await page.locator('#routine-reset').click();
  ok((await page.locator('#routine-total').innerText()).includes('277,00'),'Reset restaura sugestões');
  await page.locator('.product[data-product="c02"] .product-photo').click();
  ok(await page.locator('#atelier-dialog').isVisible(),'Ficha de cosmético abre');
  await page.locator('#dialog-close').click();
  await page.setViewportSize({width:390,height:844});
  for(const filename of ['demo-restaurante.html','demo-construtora.html','demo-clinica.html','demo-imobiliaria.html']){
    await page.goto(base+filename);
    const toggle=page.locator('.menu-toggle');
    await toggle.click();ok(await toggle.getAttribute('aria-expanded')==='true','Menu móvel abre em '+filename);
    await page.keyboard.press('Escape');ok(await toggle.getAttribute('aria-expanded')==='false','Menu móvel fecha em '+filename);
  }

  for(const [filename,selector] of [['demo-pilar.html','.nav-toggle'],['demo-nimbo.html','.menu-toggle']]){
    await page.goto(base+filename);
    const control=page.locator(selector);
    await control.click();
    ok(await control.getAttribute('aria-expanded')==='true','Menu novo abre em '+filename);
    await page.keyboard.press('Escape');
    ok(await control.getAttribute('aria-expanded')==='false','Menu novo fecha por Escape em '+filename);
  }
  for(const filename of ['demo-norte-contabil.html','demo-nexo-automacao.html']){
    await page.goto(base+filename);
    const control=page.locator('.menu-toggle');
    await control.click();
    ok(await control.getAttribute('aria-expanded')==='true','Menu B2B abre em '+filename);
    await page.keyboard.press('Escape');
    ok(await control.getAttribute('aria-expanded')==='false','Menu B2B fecha com Escape em '+filename);
  }
  for(const filename of ['demo-volta-tech.html','demo-casa-patta.html']){
    await page.goto(base+filename);
    const control=page.locator('.menu-toggle');
    await control.click();
    ok(await control.getAttribute('aria-expanded')==='true','Menu comércio abre em '+filename);
    await page.keyboard.press('Escape');
    ok(await control.getAttribute('aria-expanded')==='false','Menu comércio fecha por Escape em '+filename);
    ok(await page.locator('[data-open-cart]').isVisible(),'Sacola acessível no celular em '+filename);
  }
  for(const filename of ['demo-lume-moda.html','demo-base-norte.html']){
    await page.goto(base+filename);
    const toggle=page.locator('.menu-toggle');
    await toggle.click();
    ok(await toggle.getAttribute('aria-expanded')==='true','Menu retail abre em '+filename);
    await page.keyboard.press('Escape');
    ok(await toggle.getAttribute('aria-expanded')==='false','Menu retail fecha por Escape em '+filename);
  }
  for(const filename of ['demo-aurea-joias.html','demo-essencia-cosmeticos.html']){
    await page.goto(base+filename);
    const toggle=page.locator('.nav-toggle');
    await toggle.click();
    ok(await toggle.getAttribute('aria-expanded')==='true','Menu atelier abre em '+filename);
    await page.keyboard.press('Escape');
    ok(await toggle.getAttribute('aria-expanded')==='false','Menu atelier fecha em '+filename);
  }
  const dir=path.join(root,'tests','artifacts');fs.mkdirSync(dir,{recursive:true});
  for(const width of [390,1366]){
    await page.setViewportSize({width,height:width===390?844:900});
    for(const filename of demos){
      await page.goto(base+filename);
      await page.screenshot({path:path.join(dir,'portfolio-'+path.basename(filename,'.html')+'-'+width+'.png'),fullPage:true,animations:'disabled'});
    }
  }
  ok(errors.length===0,'Erros de script ou assets locais: '+JSON.stringify(errors));
  console.log('Portfólio: '+checks+' verificações UX aprovadas, '+demos.length*2+' capturas geradas.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
