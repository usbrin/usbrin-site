/* Run: CHROMIUM_PATH=/usr/bin/chromium node tests/studio-browser.cjs
   Requires npm package "playwright" and a compatible Chromium binary. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
  if(!f.startsWith(root+path.sep)) {res.writeHead(403);return res.end();}
  if(f.endsWith(path.sep))f=path.join(f,'index.html');
  try{const b=fs.readFileSync(f);res.setHeader('Content-Type',({'html':'text/html','css':'text/css','js':'text/javascript','png':'image/png','webp':'image/webp'})[path.extname(f).slice(1)]||'application/octet-stream');res.end(b)}
  catch(_){res.writeHead(404);res.end('Not found');}
});
(async()=>{
  let checks=0;const ok=(value,n)=>{assert.ok(value,n);checks++};
  await new Promise(resolve=>server.listen(8002,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:8002/studio.html';
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});await page.goto(url);await page.locator('#estimate').waitFor();
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow '+width);
    ok(await page.locator('#estimate').innerText()==='R$ 1.190'||(await page.locator('#estimate').innerText()).replace(/\s/g,' ')==='R$ 1.190','initial price '+width);
    ok(await page.locator('#site-preview').isVisible(),'preview visible '+width);
  }
  await page.setViewportSize({width:1280,height:900});await page.goto(url);
  const shots=path.join(root,'tests','artifacts');fs.mkdirSync(shots,{recursive:true});
  await page.screenshot({path:path.join(shots,'studio-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.goto(url);
  await page.screenshot({path:path.join(shots,'studio-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:900});await page.goto(url);
  await page.locator('input[name="product"][value="landing"]').check();
  ok(await page.locator('#pages option').count()===1,'landing one page');
  ok((await page.locator('#estimate').innerText()).includes('690'),'landing amount');
  await page.locator('input[name="product"][value="business"]').check();
  await page.locator('#pages').selectOption('7');
  await page.locator('input[name="feature"][value="blog"]').check();
  ok((await page.locator('#estimate').innerText()).includes('1.880'),'seven pages plus blog');
  await page.locator('#special').check();
  ok(!(await page.locator('#manual-review').isHidden()),'special manual review');
  ok((await page.locator('#estimate').innerText()).startsWith('A partir de'),'manual estimate label');
  await page.locator('#special').uncheck();
  await page.locator('input[name="style"][value="elegante"]').check();
  ok(await page.locator('#site-preview').getAttribute('data-style')==='elegante','preview style');
  await page.locator('#device-mobile').click();
  ok((await page.locator('#site-preview').getAttribute('class')).includes('mobile'),'preview mobile');
  await page.locator('#copy-config').click();
  ok(!(await page.locator('#quote-status').innerText()).includes('Erro inesperado'),'copy interaction safe');
  await page.locator('#name').fill('   ');
  await page.locator('#goal').fill('Teste com caracteres reservados & + % e emoji 🚀');
  await page.locator('#consent').check();
  await page.locator('.main-submit').click();
  ok(await page.locator('#message-result').isHidden(),'blank name blocked');
  await page.locator('#name').fill('Ana & José <script>');
  await page.locator('.main-submit').click();
  ok(await page.locator('#message-result').isVisible(),'message prepared after validation');
  const msg=await page.locator('#message-preview').innerText();
  const href=await page.locator('#whatsapp-link').getAttribute('href');
  const uri=new URL(href);
  ok(uri.hostname==='wa.me'&&uri.pathname==='/5569992967459','recipient matches USBRIN');
  ok(uri.searchParams.get('text')===msg,'encoded message round trip');
  ok(await page.locator('#message-preview script').count()===0,'user text is not parsed as HTML');
  ok(msg.includes('A partir')===false,'non-special message uses exact estimate text');
  await page.locator('#name').fill('Alterado');
  ok(await page.locator('#message-result').isHidden(),'edited quote invalidates message');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('usbrin-studio-config-v1')));
  ok(!JSON.stringify(stored).includes('Ana')&&!JSON.stringify(stored).includes('José'),'no personal data saved');
  await page.reload();
  ok(await page.locator('#pages').inputValue()==='7','local config restored');
  await page.goto(url+'?tipo=catalogo&paginas=9&recursos=galeria&estilo=minimalista&catalogo-ampliado=1');
  ok((await page.locator('#estimate').innerText()).startsWith('A partir de'),'share URL loaded');
  ok(await page.locator('#large-catalog').isChecked(),'catalog expanded loaded');
  ok(await page.locator('#pages').inputValue()==='9','custom page count loaded');
  ok((await page.locator('#site-preview').getAttribute('data-style'))==='minimalista','style loaded');
  page.once('dialog',dialog=>dialog.accept());await page.locator('#reset-config').click();ok(await page.locator('#pages').inputValue()==='5','reset restored defaults');
  ok(errors.length===0,'no JavaScript page errors: '+errors.join('; '));
  const response={checks,errors};console.log(JSON.stringify(response,null,2));
  await browser.close();server.close();
})().catch(error=>{console.error(error);server.close();process.exit(1)});
