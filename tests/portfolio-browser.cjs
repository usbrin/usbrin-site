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
  const demos=['portfolio.html','demo-restaurante.html','demo-construtora.html','demo-clinica.html','demo-imobiliaria.html'];
  for(const width of [360,390,768,1366]){
    await page.setViewportSize({width,height:850});
    for(const filename of demos){
      await page.goto(base+filename,{waitUntil:'domcontentloaded'});
      ok(await page.locator('h1').count()===1,filename+' tem um h1 em '+width);
      ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),
        'Rolagem horizontal '+filename+' width='+width+' atual='+await page.evaluate(()=>document.documentElement.scrollWidth));
      ok(await page.locator('a[href="portfolio.html"]').count()>=1||filename==='portfolio.html','Retorno Portfolio em '+filename);
      if(filename.startsWith('demo-')){
        ok(await page.locator('img').count()>=2,'Arte em '+filename);
        ok(await page.locator('[data-demo]').count()===1,'Id da demonstração em '+filename);
      }
    }
  }
  await page.setViewportSize({width:1366,height:900});
  await page.goto(base+'portfolio.html');await page.locator('[data-filter="construcao"]').click();
  ok(await page.locator('.project:not([hidden])').count()===3,'Filtro construção na galeria');
  await page.locator('[data-filter="todos"]').click();
  await page.locator('#portfolio-search').fill('Vitta');
  ok(await page.locator('.project:not([hidden])').count()===1,'Busca de projeto');
  await page.locator('#portfolio-search').fill('');
  ok(await page.locator('.project:not([hidden])').count()===8,'Galeria mantém 8 projetos');

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

  await page.setViewportSize({width:390,height:844});
  for(const filename of ['demo-restaurante.html','demo-construtora.html','demo-clinica.html','demo-imobiliaria.html']){
    await page.goto(base+filename);
    const toggle=page.locator('.menu-toggle');
    await toggle.click();ok(await toggle.getAttribute('aria-expanded')==='true','Menu móvel abre em '+filename);
    await page.keyboard.press('Escape');ok(await toggle.getAttribute('aria-expanded')==='false','Menu móvel fecha em '+filename);
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
