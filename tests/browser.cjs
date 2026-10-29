const fs=require('fs'), path=require('path'),http=require('http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{let f=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f.endsWith('/'))f+='index.html';try{const b=fs.readFileSync(f);res.setHeader('Content-Type',({'html':'text/html','js':'text/javascript','css':'text/css','webp':'image/webp','png':'image/png'})[f.split('.').pop()]||'application/octet-stream');res.end(b);}catch{res.statusCode=404;res.end('Not found');}});

const assert=require('node:assert/strict');
(async()=>{
 await new Promise(r=>server.listen(8001,r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/usbrin-chromium',headless:true});
 const p=await browser.newPage({reducedMotion:'reduce'}); const errors=[],network=[];let checks=0;
 const ok=(v,m)=>{assert.ok(v,m);checks++;};
 p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>network.push({url:r.url(),reason:r.failure().errorText}));
 const pages=['index.html','demo-restaurante.html','demo-construtora.html','demo-clinica.html','demo-imobiliaria.html'];
 for(const width of [320,390,768,1024,1440]){
  await p.setViewportSize({width,height:900});
  for(const file of pages){
   await p.goto('http://localhost:8001/'+file);
   ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow: '+file+' '+width);
   ok(await p.locator('h1').count()===1,'h1: '+file);
   const broken=await p.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.getAttribute('href').slice(1))).map(a=>a.getAttribute('href')));
   ok(!broken.length,'Anchors: '+JSON.stringify(broken));
   if(file==='index.html'){
    ok(!/R\$/.test(await p.locator('body').innerText()),'No public prices');
    await p.locator('.faq-question').first().click();ok(await p.locator('details').first().getAttribute('open')!==null,'FAQ open');
    await p.locator('.faq-question').first().click();ok(await p.locator('details').first().getAttribute('open')===null,'FAQ closed');
    if(width<=1100){
     await p.locator('.nav-toggle').click();ok(await p.locator('.nav-toggle').getAttribute('aria-expanded')==='true','Menu opens');
     await p.locator('.mobile-nav a[href="#contato"]').first().click();ok(await p.locator('.nav-toggle').getAttribute('aria-expanded')==='false','Menu closes on selection');
     await p.locator('.nav-toggle').click();await p.keyboard.press('Escape');ok(await p.locator('.nav-toggle').getAttribute('aria-expanded')==='false','Menu Escape');
    }
   }
  }
 }
 await p.goto('http://localhost:8001/?demo=clinica#contato');
 await p.locator('button[type="submit"]').click();ok(await p.locator('#quote-result').isHidden(),'Empty required fields blocked');
 await p.locator('#quote-name').fill('   ');await p.locator('#quote-type').selectOption('Site institucional');await p.locator('#quote-goal').selectOption('Receber contatos e pedidos de orçamento');
 await p.locator('button[type="submit"]').click();ok(await p.locator('#quote-result').isHidden(),'Whitespace name blocked');
 await p.locator('#quote-name').fill('Teste — João & Ana + 50%');await p.locator('#quote-company').fill('A&B #1');await p.locator('#quote-notes').fill('<script>alert("teste")</script>\nAção, orçamento e integração 🚀');
 await p.locator('input[value="Contato pelo WhatsApp"]').check();await p.locator('button[type="submit"]').click();
 const href=await p.locator('#quote-whatsapp').getAttribute('href'),u=new URL(href),msg=await p.locator('#quote-preview').innerText();
 ok(u.host==='wa.me' && u.pathname==='/5569992967459','Official recipient');ok(u.searchParams.get('text')===msg,'Unicode and reserved chars round trip');ok(msg.includes('Clínica'),'Demo context');ok(msg.includes('A&B #1'),'Company preserved');ok(await p.locator('#quote-preview script').count()===0,'Untrusted input rendered only as text');
 await p.locator('#quote-name').fill('Nome atualizado');ok(await p.locator('#quote-result').isHidden(),'Editing invalidates preview');
 for(const option of await p.locator('#quote-type option').allTextContents()){
  if(option==='Selecione uma opção')continue;
  await p.locator('#quote-type').selectOption(option);await p.locator('button[type="submit"]').click();ok((await p.locator('#quote-preview').innerText()).includes('Tipo de site: '+option),'Site category '+option);
 }
 await p.locator('#quote-company').fill('');await p.locator('#quote-notes').fill('');await p.locator('input[value="Contato pelo WhatsApp"]').uncheck();await p.locator('button[type="submit"]').click();ok((await p.locator('#quote-preview').innerText()).includes('A definir com orientação'),'Optional fields empty');
 await p.setViewportSize({width:390,height:844});await p.goto('http://localhost:8001/');
 await p.locator('[data-demo-next]').click();await p.waitForFunction(()=>document.querySelector('.demo-grid').scrollLeft>0);ok(true,'Carousel next');await p.locator('[data-demo-prev]').click();await p.waitForFunction(()=>document.querySelector('.demo-grid').scrollLeft<5);ok(true,'Carousel previous');
 await p.goto('http://localhost:8001/?demo=unknown');ok(await p.locator('#quote-context').isHidden(),'Unknown parameter ignored');
 // Internal resources and all local links exist, including each demo request.
 for(const file of pages){
  await p.goto('http://localhost:8001/'+file);
  const paths=await p.locator('[src],a[href],link[href]').evaluateAll(es=>es.map(e=>e.getAttribute('src')||e.getAttribute('href')).filter(x=>x&&!/^(https?:|mailto:|tel:|data:|#)/.test(x)));
  for(const dest of paths){const response=await p.request.get(new URL(dest,'http://localhost:8001/').href);ok(response.ok(),'Local link/resource '+dest);}
 }
 await p.setViewportSize({width:390,height:844});await p.goto('http://localhost:8001/');await p.screenshot({path:root+'/../mobile-home.png'});await p.locator('#quote-form').scrollIntoViewIfNeeded();await p.screenshot({path:root+'/../mobile-form.png'});
 await p.setViewportSize({width:1440,height:1000});await p.goto('http://localhost:8001/');await p.screenshot({path:root+'/../desktop-home.png'});await p.locator('#demonstracoes').scrollIntoViewIfNeeded();await p.waitForFunction(()=>[...document.querySelectorAll('.demo-preview img')].every(i=>i.complete&&i.naturalWidth>0));ok(true,'Demo images decoded');await p.screenshot({path:root+'/../desktop-demos.png'});await p.locator('#quote-form').scrollIntoViewIfNeeded();await p.screenshot({path:root+'/../desktop-form.png'});
 const nojs=await browser.newContext({javaScriptEnabled:false});const n=await nojs.newPage();await n.goto('http://localhost:8001/');ok(await n.locator('#quote-form').isHidden(),'No-JS form hidden');ok(await n.locator('.hero-copy').isVisible(),'No-JS content visible');await n.locator('.faq-question').first().click();ok(await n.locator('details').first().getAttribute('open')!==null,'No-JS FAQ');ok(await n.locator('.contact-actions a').count()===2,'No-JS direct contact');
 ok(errors.length===0,'No JS runtime errors');
 const output={checks,errors,networkFailures:[...new Map(network.map(x=>[x.url,x])).values()],viewports:[320,390,768,1024,1440],pages};
 console.log(JSON.stringify(output,null,2));fs.writeFileSync(root+'/../validation.json',JSON.stringify(output,null,2));await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
