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
  const demos=['portfolio.html','demo-restaurante.html','demo-construtora.html','demo-clinica.html','demo-imobiliaria.html','demo-atelier.html','demo-fluxo.html','demo-flor-raiz.html','demo-ponte-idiomas.html','demo-pilar.html','demo-nimbo.html','demo-norte-contabil.html','demo-nexo-automacao.html','demo-volta-tech.html','demo-casa-patta.html','demo-lume-moda.html','demo-base-norte.html','demo-aurea-joias.html','demo-essencia-cosmeticos.html','demo-vista-hotel.html','demo-motor-forma.html','demo-vereda-planejados.html','demo-sorriso-claro.html','demo-cafe-orvalho.html','demo-helena-luz.html','demo-forno-82.html'];
  for(const width of [360,390,768,1366]){
    await page.setViewportSize({width,height:850});
    for(const filename of demos){
      await page.goto(base+filename,{waitUntil:'domcontentloaded'});
      ok(await page.locator('h1').count()===1,filename+' tem um h1 em '+width);
      ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),
        'Rolagem horizontal '+filename+' width='+width+' atual='+await page.evaluate(()=>document.documentElement.scrollWidth));
      ok(await page.locator('a[href="portfolio.html"]').count()>=1||filename==='portfolio.html','Retorno Portfolio em '+filename);
      if(filename.startsWith('demo-')){
        const earlyConcepts=new Set(['demo-atelier.html','demo-fluxo.html','demo-flor-raiz.html','demo-ponte-idiomas.html']);
        if(earlyConcepts.has(filename)){
          ok(await page.locator('section').count()>=4,'Projeto inicial mantém conteúdo completo em '+filename);
          ok(await page.locator('a[href^="studio.html"]').count()>=1,'Projeto inicial encaminha para Studio em '+filename);
        }else{
          ok(await page.locator('img').count()>=(filename.includes('contabil')||filename.includes('automacao')?1:2),'Arte em '+filename);
          ok(await page.locator('[data-demo], [data-suite], [data-shop], [data-retail], [data-atelier], [data-experience], [data-specialist], [data-editorial]').count()===1,'Id da demonstração em '+filename);
        }
      }
    }
  }
  await page.setViewportSize({width:1366,height:900});
  await page.goto(base+'portfolio.html');await page.locator('[data-filter="construcao"]').click();
  ok(await page.locator('.project:not([hidden])').count()===5,'Filtro construção na galeria com Vereda Planejados');
  await page.locator('[data-filter="todos"]').click();
  await page.locator('#portfolio-search').fill('Vitta');
  ok(await page.locator('.project:not([hidden])').count()===1,'Busca de projeto');
  await page.locator('#portfolio-search').fill('');
  ok(await page.locator('.project:not([hidden])').count()===25,'Galeria mantém 25 projetos');

  // Forno 82: filtro, cálculo didático, seleção local e limpeza.
  await page.goto(base+'demo-forno-82.html');
  await page.locator('button[data-kind="vegetarianas"]').click();
  ok(await page.locator('.pizza:not([hidden])').count()===2,'Forno 82 filtra vegetarianas');
  await page.locator('#pizza-search').fill('jardim');
  ok(await page.locator('.pizza:not([hidden])').count()===1,'Forno 82 combina busca e categoria');
  await page.locator('button[data-kind="todos"]').click();
  await page.locator('#pizza-search').fill('');
  await page.locator('[data-pick="brasata"]').click();
  ok(await page.locator('#pizza-flavor').inputValue()==='brasata','Forno 82 seleciona sabor do cardápio');
  await page.locator('#pizza-size').selectOption('grande');
  await page.locator('#pizza-edge').selectOption('recheada');
  await page.locator('#pizza-qty').fill('2');
  ok((await page.locator('#pizza-preview').innerText()).includes('190,00'),'Forno 82 calcula escolha em centavos');
  await page.locator('#pizza-add').click();
  ok((await page.locator('#order-count').innerText()).includes('2 de 8'),'Forno 82 soma quantidades');
  ok((await page.locator('#order-total').innerText()).includes('190,00'),'Forno 82 soma total sem pedido real');
  ok(await page.locator('#order-copy').isEnabled(),'Forno 82 permite cópia voluntária');
  await page.locator('#order-clear').click();
  ok((await page.locator('#order-total').innerText()).includes('0,00'),'Forno 82 limpa carrinho ilustrativo');

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
  // Testa um clique físico no centro do controle modal; confirma hit-test e fechamento.
  const closeBox=await page.locator('[data-close-cart]').boundingBox();
  ok(!!closeBox && closeBox.width>0 && closeBox.height>0,'Botão de fechar sacola possui área clicável');
  const closeX=closeBox.x+closeBox.width/2,closeY=closeBox.y+closeBox.height/2;
  ok(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.closest('[data-close-cart]')!==null,[closeX,closeY]),'Botão de fechar recebe hit-test no navegador');
  await page.mouse.click(closeX,closeY);
  ok(await page.locator('#cart-dialog').isHidden(),'Sacola fecha após clique físico');

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
  let closeArea=await page.locator('[data-close-cart]').boundingBox();
  ok(!!closeArea,'Sacola mantém botão de fechamento acessível');
  await page.mouse.click(closeArea.x+closeArea.width/2,closeArea.y+closeArea.height/2);
  ok(await page.locator('#cart-dialog').isHidden(),'Sacola fecha por clique real');
  await page.locator('[data-view="p04"]').first().click();
  await page.locator('#detail-variant').selectOption('M');
  await page.locator('#detail-add').click();
  ok(await page.locator('.cart-line').count()===2,'Casa Patta reúne duas variações na sacola');
  ok((await page.locator('#cart-delivery').innerText()).includes('Grátis'),'Frete ilustrativo ao cruzar limite');
  closeArea=await page.locator('[data-close-cart]').boundingBox();
  ok(!!closeArea,'Sacola mantém botão de fechamento acessível');
  await page.mouse.click(closeArea.x+closeArea.width/2,closeArea.y+closeArea.height/2);
  ok(await page.locator('#cart-dialog').isHidden(),'Sacola fecha por clique real');


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
  ok(await page.locator('#atelier-dialog').isHidden(),'Ficha de joia fecha após seleção; erros: '+JSON.stringify(errors.slice(-4)));
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


  // Vista Hotel — escolha real de suíte e estimativa didática por noites e ocupação.
  await page.goto(base+'demo-vista-hotel.html');
  ok(await page.locator('.room-card').count()===3,'Vista Hotel apresenta três suítes');
  await page.locator('[data-room="vista"]').click();
  ok((await page.locator('#hotel-room-label').innerText()).includes('Panorama'),'Troca de suíte reflete no resumo');
  await page.locator('#hotel-arrival').fill('2027-01-05');
  await page.locator('#hotel-departure').fill('2027-01-07');
  await page.locator('#hotel-guests').selectOption('3');
  ok((await page.locator('#hotel-nights').innerText()).includes('2 noites'),'Duração em noites calculada');
  ok((await page.locator('#hotel-total').innerText()).includes('2.240,00'),'Total hipotético de duas noites');
  await page.locator('#hotel-breakfast').check();
  ok((await page.locator('#hotel-total').innerText()).includes('2.750,00'),'Café opcional altera valor');
  await page.locator('#hotel-guests').selectOption('4');
  ok(await page.locator('#hotel-error').isVisible(),'Capacidade de acomodação é validada');
  await page.locator('#hotel-guests').selectOption('2');
  ok(await page.locator('#hotel-error').isHidden(),'Cenário corrigido fica válido');
  await page.locator('[data-select-room="classic"]').click();
  ok((await page.locator('#hotel-room-label').innerText()).includes('Jardim'),'Cartão da suíte altera planejamento');

  // Motor & Forma — orçamentação simulada com porte, pacote e complementos.
  await page.goto(base+'demo-motor-forma.html');
  ok(await page.locator('.service-card').count()===3,'Motor & Forma apresenta três serviços');
  await page.locator('[data-service="signature"]').click();
  await page.locator('input[name="vehicle-size"][value="suv"]').check();
  await page.locator('[data-extra="interior"]').check();
  await page.locator('[data-extra="paint"]').check();
  ok((await page.locator('#auto-price-total').innerText()).includes('2.355,00'),'Total ilustrativo com porte e complementos');
  ok((await page.locator('#auto-duration').innerText()).includes('15 h'),'Horas exemplificativas calculadas');
  await page.locator('[data-extra="paint"]').uncheck();
  ok((await page.locator('#auto-price-total').innerText()).includes('2.115,00'),'Remoção de complemento recalcula');
  await page.locator('[data-card-service="express"]').click();
  ok((await page.locator('#auto-package-title').innerText()).includes('Essencial'),'Botão do serviço preenche configurador');


  // Vereda Planejados — opções, medidas hipotéticas e geração local de briefing.
  await page.goto(base+'demo-vereda-planejados.html');
  ok(await page.locator('.vereda-room').count()===3,'Vereda mostra três ambientes fotográficos');
  await page.locator('[data-room="closet"]').click();
  ok((await page.locator('#vereda-summary-room').innerText()).includes('Closet'),'Vereda muda o ambiente de referência');
  await page.locator('[data-finish="grafite"]').click();
  ok((await page.locator('#vereda-summary-finish').innerText()).includes('Grafite'),'Acabamento ilustrativo atualizado');
  await page.locator('[data-layout="l"]').click();
  await page.locator('#vereda-width').fill('4.4');
  await page.locator('#vereda-height').fill('2.7');
  await page.locator('#vereda-notes').fill('Quero armazenamento funcional com acabamento discreto.');
  ok((await page.locator('#vereda-dimensions').innerText()).includes('4,4 m'),'Dimensão aproximada é formatada');
  ok((await page.locator('#vereda-summary-detail').innerText()).includes('duas paredes'),'Opção de layout altera resumo');
  await page.locator('#vereda-width').fill('0.3');
  ok(await page.locator('#vereda-error').isVisible(),'Vereda valida medida fora dos limites');
  ok(await page.locator('#vereda-copy').isDisabled(),'Vereda impede cópia de medida inválida');
  await page.locator('#vereda-width').fill('4.4');
  ok(await page.locator('#vereda-error').isHidden(),'Vereda revalida medida corrigida');
  await page.locator('#vereda-reset').click();
  ok((await page.locator('#vereda-summary-room').innerText()).includes('Cozinha'),'Vereda reseta ambiente');
  ok((await page.locator('#vereda-summary-finish').innerText()).includes('Madeira'),'Vereda reseta acabamento');

  // Sorriso Claro — navegação institucional sem anamnese ou dados médicos.
  await page.goto(base+'demo-sorriso-claro.html');
  ok(await page.locator('.specialty-card').count()===4,'Sorriso Claro mostra quatro áreas conceituais');
  await page.locator('[data-specialty="ortodontia"]').click();
  ok(await page.locator('#dental-specialty').inputValue()==='ortodontia','Escolher área prepara mensagem');
  ok((await page.locator('#dental-message').innerText()).includes('Ortodontia'),'Mensagem institucional acompanha especialidade');
  await page.locator('#dental-topic').selectOption('avaliacao');
  await page.locator('#dental-shift').selectOption('tarde');
  ok((await page.locator('#dental-message').innerText()).includes('Saber como solicitar uma avaliação'),'Tema de contato atualizado');
  ok((await page.locator('#dental-message').innerText()).includes('tarde'),'Preferência de horário atualizada');
  ok((await page.locator('#dental-message').innerText()).includes('Não inclua dados de saúde'),'Aviso de privacidade visível no resumo');
  await page.locator('#dental-reset').click();
  ok((await page.locator('#dental-message').innerText()).includes('Clínica geral'),'Reset da mensagem funciona');

  // Café Orvalho — seleção ilustrativa, filtro e combinações sem compra real.
  await page.goto(base+'demo-cafe-orvalho.html');
  ok(await page.locator('.item-card').count()===9,'Orvalho apresenta nove referências fotográficas');
  await page.locator('[data-category="Cafés"]').click();
  ok(await page.locator('.item-card').count()===3,'Orvalho filtra cafés');
  await page.locator('#cafe-search').fill('latte');
  ok(await page.locator('.item-card').count()===1,'Orvalho filtra texto sem recarregar');
  await page.locator('#cafe-search').fill('');
  await page.locator('[data-category="Todos"]').click();
  await page.locator('[data-moment="pausa"]').click();
  await page.locator('#cafe-add-moment').click();
  ok((await page.locator('#cafe-selected-count').innerText()).includes('2 de 4'),'Sugestão adiciona dois itens');
  ok(!(await page.locator('#cafe-copy').isDisabled()),'Resumo pode ser copiado quando há seleção');
  await page.locator('[data-add="o02"]').click();
  await page.locator('[data-add="o03"]').click();
  ok((await page.locator('#cafe-selected-count').innerText()).includes('4 de 4'),'Seleção permite quatro produtos diferentes');
  await page.locator('[data-add="o04"]').click();
  ok((await page.locator('#cafe-selected-count').innerText()).includes('4 de 4'),'Quinto item é impedido');
  await page.locator('.selected-row .qty-control').first().fill('2');
  await page.locator('.selected-row .qty-control').first().dispatchEvent('change');
  ok((await page.locator('#cafe-total').innerText()).includes('81,00'),'Alteração de quantidade recalcula seleção');
  await page.locator('#cafe-clear').click();
  ok((await page.locator('#cafe-total').innerText()).includes('0,00'),'Cafeteria limpa seleção sem pedido');
  ok(await page.locator('#cafe-copy').isDisabled(),'Sem itens, resumo fica indisponível');

  // Helena Luz — galeria navegável via teclado e briefing de sessão sem agendamento.
  await page.goto(base+'demo-helena-luz.html');
  ok(await page.locator('.photo-tile').count()===8,'Helena mostra oito fotos editoriais de referência');
  await page.locator('[data-category="Retratos"]').click();
  ok(await page.locator('.photo-tile').count()===3,'Helena filtra retratos');
  await page.locator('.photo-tile').first().click();
  ok(await page.locator('#helena-dialog').isVisible(),'Galeria abre lightbox');
  ok((await page.locator('#helena-modal-title').innerText()).includes('Luz de manhã'),'Lightbox mostra título da referência');
  await page.locator('#helena-next').click();
  ok((await page.locator('#helena-modal-title').innerText()).includes('Entre luzes'),'Lightbox avança para próxima imagem');
  await page.keyboard.press('ArrowLeft');
  ok((await page.locator('#helena-modal-title').innerText()).includes('Luz de manhã'),'Seta do teclado navega para imagem anterior');
  await page.keyboard.press('Escape');
  ok(await page.locator('#helena-dialog').isHidden(),'Escape fecha a foto ampliada');
  await page.locator('[data-category="Editorial"]').click();
  ok(await page.locator('.photo-tile').count()===3,'Helena filtra ensaios editoriais');
  await page.locator('#session-type').selectOption('editorial');
  await page.locator('#session-place').selectOption('externo');
  await page.locator('#session-delivery').selectOption('selecao');
  await page.locator('#session-notes').fill('Retratos externos com luz natural.');
  ok((await page.locator('#session-preview').innerText()).includes('Editorial de marca'),'Briefing informa o tipo correto');
  ok((await page.locator('#session-preview').innerText()).includes('Retratos externos com luz natural'),'Briefing contém observação digitada');
  await page.locator('#session-reset').click();
  ok((await page.locator('#session-preview').innerText()).includes('Retrato pessoal'),'Reset restaura tipo original');
  // Portfolio 2.0: o interesse por cada projeto vira um briefing contextual copiável.
  await page.goto(base+'portfolio.html');
  const firstBrief=page.locator('[data-project-brief]').first();
  ok(await page.locator('[data-project-brief]').count()===25,'Vinte e cinco CTAs de briefing contextual');
  await firstBrief.click();
  ok(await page.locator('#project-brief-dialog').isVisible(),'Briefing abre ao escolher referência');
  ok((await page.locator('#brief-project-name').innerText()).includes('Brasa & Mesa'),'Nome correto da referência comercial');
  ok((await page.locator('#brief-preview').innerText()).includes('Brasa & Mesa'),'Resumo inclui referência');
  await page.locator('#brief-objective').selectOption('contatos');
  await page.locator('#brief-notes').fill('Quero um site de restaurante com cardápio e contato por WhatsApp.');
  ok((await page.locator('#brief-preview').innerText()).includes('cardápio e contato por WhatsApp'),'Resumo reage às informações opcionais');
  const mailto=await page.locator('#brief-email').getAttribute('href');
  ok(mailto.startsWith('mailto:usbrin.contato@gmail.com?'),'E-mail é preparado sem envio automático');
  ok(mailto.includes(encodeURIComponent('Brasa & Mesa')),'E-mail inclui contexto do projeto');
  await page.locator('#brief-close').click();
  ok(await page.locator('#project-brief-dialog').isHidden(),'Modal fecha sem interferir nos filtros');
  await page.locator('[data-filter="moda"]').click();
  await page.locator('.project[data-search*="Essência Cosméticos"] [data-project-brief]').click();
  ok((await page.locator('#brief-project-name').innerText()).includes('Essência Cosméticos'),'Seleciona corretamente outra referência');
  await page.keyboard.press('Escape');
  ok(await page.locator('#project-brief-dialog').isHidden(),'Briefing fecha pelo teclado');
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'portfolio.html');
  await page.locator('[data-project-brief]').first().click();
  ok(await page.locator('#project-brief-dialog').isVisible(),'Briefing acessível no celular');
  const modalWidth=await page.locator('#project-brief-dialog').evaluate(el=>el.getBoundingClientRect().width);
  ok(modalWidth<=390,'Briefing não ultrapassa a tela mobile');
  await page.keyboard.press('Escape');
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


  for(const file of ['demo-vereda-planejados.html','demo-sorriso-claro.html']){
    await page.goto(base+file);
    const control=page.locator('.nav-toggle');
    await control.click();
    ok(await control.getAttribute('aria-expanded')==='true','Menu abre no celular em '+file);
    await page.keyboard.press('Escape');
    ok(await control.getAttribute('aria-expanded')==='false','Menu fecha via teclado em '+file);
  }

  for(const file of ['demo-cafe-orvalho.html','demo-helena-luz.html']){
    await page.goto(base+file);
    const toggle=page.locator('.menu-toggle');
    await toggle.click();
    ok(await toggle.getAttribute('aria-expanded')==='true','Menu editorial abre no celular em '+file);
    await page.keyboard.press('Escape');
    ok(await toggle.getAttribute('aria-expanded')==='false','Menu editorial fecha por Escape em '+file);
  }
  // Os novos sites devem manter navegação utilizável no celular.
  for(const file of ['demo-vista-hotel.html','demo-motor-forma.html']){
    await page.goto(base+file);
    const control=page.locator('.nav-toggle');
    await control.click();
    ok(await control.getAttribute('aria-expanded')==='true','Menu abre no celular em '+file);
    await page.keyboard.press('Escape');
    ok(await control.getAttribute('aria-expanded')==='false','Menu fecha via teclado em '+file);
  }
  // Auditoria visual efetiva: HTML HTTP 200 não significa que o browser decodificou fotos.
  for(const filename of ['demo-aurea-joias.html','demo-essencia-cosmeticos.html']){
    await page.goto(base+filename);
    ok(await page.locator('.product').count()===6,'Catálogo fotográfico disponível em '+filename);
    const media=await page.evaluate(async ()=>{
      const imgs=[...document.images].filter(img=>/^https:\/\/images\.(?:unsplash|pexels)\.com\//.test(img.currentSrc||img.src));
      imgs.forEach(img=>{img.loading='eager';});
      await Promise.race([
        Promise.allSettled(imgs.map(img=>img.decode())),
        new Promise(resolve=>setTimeout(resolve,12000))
      ]);
      return imgs.map(img=>({loaded:img.naturalWidth>0,url:img.currentSrc.split('?')[0],alt:img.alt}));
    });
    console.log('PORTFOLIO_MEDIA_BROWSER',filename,JSON.stringify({total:media.length,loaded:media.filter(i=>i.loaded).length,broken:media.filter(i=>!i.loaded)}));
    ok(media.length>=8,'Fotografias de hero, catálogo e editorial presentes em '+filename);
    ok(media.every(item=>item.loaded),'Imagens efetivamente decodificadas em '+filename+': '+JSON.stringify(media.filter(item=>!item.loaded)));
  }

  // Imagens externas das novas experiências: validar decodificação no Chrome.
  for(const [file,minimum] of [['demo-vista-hotel.html',6],['demo-motor-forma.html',3]]){
    await page.goto(base+file);
    const images=await page.evaluate(async()=>{
      const list=[...document.images].filter(img=>/^https:\/\/images\.unsplash\.com\/photo-/.test(img.currentSrc||img.src));
      list.forEach(img=>{img.loading='eager';});
      await Promise.race([Promise.allSettled(list.map(img=>img.decode())),new Promise(resolve=>setTimeout(resolve,13000))]);
      return list.map(img=>({ok:img.naturalWidth>0,url:(img.currentSrc||img.src).split('?')[0]}));
    });
    console.log('PORTFOLIO_NEW_MEDIA',file,JSON.stringify({total:images.length,loaded:images.filter(x=>x.ok).length,failed:images.filter(x=>!x.ok)}));
    ok(images.length>=minimum,'Catálogo fotográfico completo em '+file);
    ok(images.every(img=>img.ok),'Fotografia não decodificada em '+file+': '+JSON.stringify(images.filter(img=>!img.ok)));
  }
  for(const [file,minimum] of [['demo-vereda-planejados.html',7],['demo-sorriso-claro.html',6]]){
    await page.goto(base+file);
    const media=await page.evaluate(async()=>{
      const list=[...document.images].filter(img=>/^https:\/\/images\.unsplash\.com\/photo-/.test(img.currentSrc||img.src));
      list.forEach(img=>img.loading='eager');
      await Promise.race([Promise.allSettled(list.map(img=>img.decode())),new Promise(resolve=>setTimeout(resolve,14000))]);
      return list.map(img=>({ok:img.naturalWidth>0,url:(img.currentSrc||img.src).split('?')[0]}));
    });
    console.log('PORTFOLIO_SPECIALIST_MEDIA',file,JSON.stringify({total:media.length,loaded:media.filter(m=>m.ok).length,failed:media.filter(m=>!m.ok)}));
    ok(media.length>=minimum,'Fotos de apresentação e catálogo em '+file);
    ok(media.every(m=>m.ok),'Fotos decodificadas em '+file+': '+JSON.stringify(media.filter(m=>!m.ok)));
  }

  // Novos projetos fotográficos: validar decodificação no Chrome, não apenas status HTTP.
  for(const [file,minImages] of [['demo-cafe-orvalho.html',12],['demo-helena-luz.html',10],['demo-forno-82.html',8]]){
    await page.goto(base+file);
    const images=await page.evaluate(async()=>{
      const pics=[...document.images].filter(img=>/^https:\/\/images\.unsplash\.com\/photo-/.test(img.currentSrc||img.src));
      pics.forEach(img=>img.loading='eager');
      await Promise.race([Promise.allSettled(pics.map(img=>img.decode())),new Promise(resolve=>setTimeout(resolve,14500))]);
      return pics.map(img=>({ok:img.naturalWidth>0,url:(img.currentSrc||img.src).split('?')[0]}));
    });
    console.log('PORTFOLIO_EDITORIAL_MEDIA',file,JSON.stringify({total:images.length,loaded:images.filter(x=>x.ok).length,failed:images.filter(x=>!x.ok)}));
    ok(images.length>=minImages,'Galeria de fotos de referência presente em '+file);
    ok(images.every(x=>x.ok),'Fotos externas decodificadas em '+file+': '+JSON.stringify(images.filter(x=>!x.ok)));
  }
  const dir=path.join(root,'tests','artifacts');fs.mkdirSync(dir,{recursive:true});
  for(const width of [390,1366]){
    await page.setViewportSize({width,height:width===390?844:900});
    for(const filename of demos){
      await page.goto(base+filename);
      // Capturas full-page exigem carregar imagens lazy antes de fotografar a página inteira.
      // Evita concluir incorretamente que cards abaixo da dobra estão sem fotografia.
      const photoState=await page.evaluate(async()=>{
        const pictures=[...document.images];
        for(const img of pictures)img.loading='eager';
        await Promise.race([
          Promise.all(pictures.map(img=>img.decode().catch(()=>{}))),
          new Promise(resolve=>setTimeout(resolve,2400))
        ]);
        return {loaded:pictures.filter(img=>img.complete&&img.naturalWidth>0).length,total:pictures.length};
      });
      if(filename==='demo-aurea-joias.html'||filename==='demo-essencia-cosmeticos.html')
        console.log('FOTOGRAFIAS',filename,width,JSON.stringify(photoState));
      await page.screenshot({path:path.join(dir,'portfolio-'+path.basename(filename,'.html')+'-'+width+'.png'),fullPage:true,animations:'disabled'});
    }
  }
  ok(errors.length===0,'Erros de script ou assets locais: '+JSON.stringify(errors));
  console.log('Portfólio: '+checks+' verificações UX aprovadas, '+demos.length*2+' capturas geradas.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
