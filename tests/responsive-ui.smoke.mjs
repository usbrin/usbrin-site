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
    'admin/users':{ok:true,users:[]}
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
       await page.locator('#identity').getByText('Conta:',{exact:false}).waitFor({timeout:15000}).catch(()=>{});
       await page.waitForFunction(()=>document.querySelector('#portal-status')?.textContent?.includes('Dados atualizados'),{timeout:15000});
       const identity=await page.locator('#identity').textContent();
       assert.ok(identity?.includes(role),'Wrong account role: '+identity);
       const visible=await page.locator('#portal-nav button:not(.hidden)').evaluateAll(items=>items.map(x=>x.dataset.view));
       const expected=role==='admin'?['overview','leads','applications','studio','partners','projects','commissions']:role==='representante'?['overview','leads','commissions']:['overview','projects','commissions'];
       assert.deepEqual(visible,expected,role+' navigation mismatch');
       if(role==='admin'){
         await page.locator('#portal-nav [data-view="partners"]').click();
         await page.waitForFunction(()=>document.querySelector('#panel-title')?.textContent==='Parceiros');
         assert.ok((await page.locator('#partner-list').innerText()).includes('Nenhum registro disponível'));
       }else if(role==='representante'){
         await page.locator('#portal-nav [data-view="leads"]').click();
       }else{
         await page.locator('#portal-nav [data-view="projects"]').click();
       }
       await assertFits(page,role+' '+width);
       assert.deepEqual(errors,[],'Page errors '+role+' '+width);
       await page.screenshot({path:resolve(outDir,role+'-'+width+'.png'),fullPage:true});
       console.log('PASS portal',role,width);
     }finally{await context.close();}
   }
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
