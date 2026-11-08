import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';

// UI smoke: isolated local build. All API responses below are in-memory mocks.
// Never use live credentials, partner e-mails or production data in browser tests.
const browser=await chromium.launch({headless:true});
const outDir=resolve('ui-smoke-artifacts');
await mkdir(outDir,{recursive:true});
const fixture={
  admin: {
    me:{ok:true,user:{name:'HOMOLOGAÇÃO Admin',role:'admin'}},
    'admin/overview':{ok:true,applications:[],users:[],projects:[],opportunities:[],receivedCents:0,commissionsPendingCents:0,studioInquiries:[],tasks:{}},
    'admin/users':{ok:true,users:[]},
    'crm/proposals':{ok:true,proposals:[{id:'mock-approved-quote-001',code:'Q0123456789ABC',opportunity_id:'mock-quote-op-1234',customer_company:'Empresa Demonstrativa',customer_contact:'Contato Comercial',scope:'Site institucional responsivo com cinco páginas, navegação, formulário de contato, revisão final e publicação orientada.',product:'business',price_cents:119000,duration_days:20,valid_until:'2027-02-20',terms:'O cronograma e o pagamento serão formalizados por contrato.',status:'approved',created_at:'2026-11-07 12:00:00'}]}
  },
  representante:{
    me:{ok:true,user:{name:'HOMOLOGAÇÃO Representante',role:'representante'}},
    'representante/dashboard':{ok:true,leads:[],commissions:[],goals:[],sales:[]}
  },
  desenvolvedor:{
    me:{ok:true,user:{name:'HOMOLOGAÇÃO Desenvolvedor',role:'desenvolvedor'}},
    'desenvolvedor/dashboard':{ok:true,projects:[],payments:[]}
  }
};
const portalUrl=pathToFileURL(resolve('dist/portal.html')).href;
const recruitmentUrl=pathToFileURL(resolve('dist/public/parceiros.html')).href;
const applyUrl=pathToFileURL(resolve('dist/public/candidatura.html')).href+'?area=representante';
const proposalUrl=pathToFileURL(resolve('dist/proposta.html')).href+'?o=mock-quote-op-1234&p=mock-approved-quote-001';

async function pageFor(role,width,url){
 const context=await browser.newContext({viewport:{width,height:812},deviceScaleFactor:1});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({role,fixture})=>{
   window.fetch=async(input)=>{
     const path=String(input);
     let result=null;
     if(path.includes('api/public-config'))result={ok:true,applicationsOpen:false,studioInquiriesOpen:false,turnstileSiteKey:null};
     else if(path.includes('/api/private/')){
       const endpoint=path.split('/api/private/')[1].split('?')[0];
       result=fixture[role]?.[endpoint]||{ok:false,error:'Endpoint não simulado'};
     }
     if(result)return new Response(JSON.stringify(result),{status:result.ok?200:404,headers:{'content-type':'application/json'}});
     return new Response('Não encontrado',{status:404});
   };
 },{role,fixture});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>document.fonts.ready);
 return {context,page,errors};
}
async function assertFits(page,label){
 const dims=await page.evaluate(()=>({
   body:document.body.scrollWidth,document:document.documentElement.scrollWidth,
   width:innerWidth,main:document.querySelector('main')?.getBoundingClientRect().right
 }));
 assert.ok(dims.document<=dims.width+2,label+' viewport overflow: '+JSON.stringify(dims));
}

try{
 for(const width of [375,768,1440]){
   for(const role of ['admin','representante','desenvolvedor']){
     const {context,page,errors}=await pageFor(role,width,portalUrl);
     try{
       await page.waitForFunction(()=>document.querySelector('#portal-status')?.textContent?.includes('Dados atualizados'),{timeout:15000});
       const identity=await page.locator('#identity').textContent();
       assert.ok(identity?.includes(role),'Wrong account role: '+identity);
       const visible=await page.locator('#portal-nav button:not(.hidden)').evaluateAll(items=>items.map(x=>x.dataset.view));
       const expected=role==='admin'?['overview','leads','guide','applications','studio','partners','projects','commissions']:role==='representante'?['overview','leads','guide','commissions']:['overview','projects','commissions'];
       assert.deepEqual(visible,expected,role+' navigation mismatch');
       if(role==='admin'){
         await page.locator('#portal-nav [data-view="partners"]').click();
         await page.locator('#partner-list').getByText('Nenhum registro disponível.',{exact:true}).waitFor({timeout:15000});
       }else if(role==='representante'){
         await page.locator('#portal-nav [data-view="leads"]').click();
       }else{
         await page.locator('#portal-nav [data-view="projects"]').click();
       }
       if(role==='admin'||role==='representante'){
         await page.locator('#portal-nav [data-view="guide"]').click();
         await page.locator('#view-guide').waitFor({state:'visible'});
         const cards=page.locator('.sales-plan');
         assert.equal(await cards.count(),3,'Three official plans required');
         const prices=await page.locator('.sales-price').allTextContents();
         assert.deepEqual(prices,['A partir de R$ 690','A partir de R$ 1.190','A partir de R$ 1.790']);
         assert.equal(await page.locator('#sales-checklist input[type="checkbox"]').count(),5);
         assert.equal(await page.locator('#guide-addon-list .sales-addon-row').count(),5);
         assert.ok((await page.locator('[data-guide-feature="blog"]').innerText()).includes('450'));
         assert.ok((await page.locator('[data-guide-feature="formulario"]').innerText()).includes('150'));
         assert.ok((await page.locator('[data-guide-feature="galeria"]').innerText()).includes('180'));
         assert.ok((await page.locator('#guide-extra-page-price').innerText()).includes('120'));
         const total=page.locator('#guide-estimate-total');
         assert.ok((await total.innerText()).includes('1.190'),'Business base price should be sourced from Studio');
         await page.locator('#guide-estimate-features input[value="blog"]').check();
         assert.ok((await total.innerText()).includes('1.640'),'Business + blog should total 1640');
         await page.locator('#guide-estimate-features input[value="formulario"]').check();
         assert.ok((await total.innerText()).includes('1.790'),'Business + blog + form should total 1790');
         await page.locator('#guide-estimate-pages').fill('7');
         assert.ok((await total.innerText()).includes('2.030'),'Adding 2 pages should add 240');
         await page.locator('#guide-estimate-product').selectOption('landing');
         assert.ok((await total.innerText()).includes('1.290'),'Landing + blog + form should total 1290');
         assert.equal(await page.locator('#guide-estimate-pages').isDisabled(),true);
         await page.locator('#guide-estimate-product').selectOption('catalogo');
         assert.ok((await total.innerText()).includes('2.390'),'Catalog + blog + form should total 2390');

         await page.locator('#sales-checklist input[type="checkbox"]').first().check();
         assert.ok((await page.locator('#sales-guide-progress').innerText()).includes('1 de 5'));
         await assertFits(page,role+' guide '+width);
         await page.locator('#guide-goto-leads').click();
         await page.locator('#view-leads').waitFor({state:'visible'});
         if(role==='representante'){
           await page.locator('#lead-open-guide').click();
           await page.locator('#view-guide').waitFor({state:'visible'});
           await page.locator('#portal-nav [data-view="leads"]').click();
         }
       }else{
         assert.equal(await page.locator('#portal-nav [data-view="guide"]').isVisible(),false);
       }
       await assertFits(page,role+' '+width);
       assert.deepEqual(errors,[],'Page errors '+role+' '+width);
       await page.screenshot({path:resolve(outDir,role+'-'+width+'.png'),fullPage:true});
       console.log('PASS portal',role,width);
     }finally{await context.close();}
   }
   const printed=await pageFor('admin',width,proposalUrl);
   try{
     await printed.page.locator('#proposal-document').waitFor({state:'visible',timeout:15000});
     assert.ok((await printed.page.locator('#proposal-customer').innerText()).includes('Empresa Demonstrativa'));
     assert.ok((await printed.page.locator('#proposal-price').innerText()).includes('1.190,00'));
     assert.equal(await printed.page.locator('#print-proposal').isEnabled(),true);
     await assertFits(printed.page,'approved-proposal '+width);
     assert.deepEqual(printed.errors,[],'Proposal page errors '+width);
     await printed.page.screenshot({path:resolve(outDir,'approved-proposal-'+width+'.png'),fullPage:true});
     if(width===1440){
       const pdf=await printed.page.pdf({path:resolve(outDir,'approved-proposal-print.pdf'),format:'A4',printBackground:true});
       assert.ok(pdf.length>12000,'Browser must generate a nonempty PDF');
       assert.equal(pdf.subarray(0,4).toString(),'%PDF');
     }
     console.log('PASS approved proposal / PDF',width);
   }finally{await printed.context.close();}
   for(const [name,url] of [['recruitment',recruitmentUrl],['candidate-closed',applyUrl]]){
     const {context,page,errors}=await pageFor('admin',width,url);
     try{
       if(name==='candidate-closed')await page.waitForFunction(()=>document.querySelector('#availability')?.textContent?.includes('ainda não estão abertas'),{timeout:15000});
       await assertFits(page,name+' '+width);
       assert.deepEqual(errors,[],'Page errors '+name+' '+width);
       await page.screenshot({path:resolve(outDir,name+'-'+width+'.png'),fullPage:true});
       console.log('PASS',name,width);
     }finally{await context.close();}
   }
 }
}finally{await browser.close();}
