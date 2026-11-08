import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';

// UI smoke: isolated local build. All API responses below are in-memory mocks.
// Never use live credentials, partner e-mails or production data in browser tests.
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
const outDir=resolve('ui-smoke-artifacts');
await mkdir(outDir,{recursive:true});
const fixture={
  admin: {
    me:{ok:true,user:{name:'HOMOLOGAÇÃO Admin',role:'admin'}},
    'admin/overview':{ok:true,applications:[],users:[],projects:[],opportunities:[],receivedCents:0,commissionsPendingCents:0,studioInquiries:[],tasks:{}},
    'admin/users':{ok:true,users:[]},
    'admin/opportunities':{ok:true,opportunities:[{id:'op-briefing-demo-001',company:'Cliente Homologação UX',contact:'Contato Exemplo',stage:'new',product:'Business',estimated_cents:119000}]},
    'admin/sales':{ok:true,sales:[{id:'sale-handoff-demo-001',company:'Cliente Homologação UX',gross_cents:179000,received_cents:179000,approved_proposal_id:'proposal-approved-demo-001',approved_proposal_code:'QTESTDEMO001',approved_scope:'BRIEFING APROVADO: cinco páginas, blog gerenciável e contato por WhatsApp.'}]},
    'admin/projects':{ok:true,projects:[]},
    'admin/developer-payments':{ok:true,payments:[]},
    'admin/billing/overview':{ok:true,today:'2026-11-07',listsLimitedTo:400,
      totals:{agreementsActive:1,openCents:25000,overdueCents:0,receivedCents:25000,paidCount:1},
      agreements:[{id:'agreement-mock-001',sale_id:'sale-handoff-demo-001',company:'Cliente Homologação UX',kind:'support',cadence:'monthly',amount_cents:25000,start_on:'2026-10-01',contract_reference:'SIGNED-MOCK-001',status:'active'}],
      eligibleSales:[{id:'sale-handoff-demo-001',company:'Cliente Homologação UX',gross_cents:119000,received_cents:119000}],
      charges:[{id:'charge-mock-002',agreement_id:'agreement-mock-001',company:'Cliente Homologação UX',kind:'support',period:'2026-11',due_on:'2026-11-15',amount_cents:25000,received_cents:0,status:'pending'},
        {id:'charge-mock-001',agreement_id:'agreement-mock-001',company:'Cliente Homologação UX',kind:'support',period:'2026-10',due_on:'2026-10-15',amount_cents:25000,received_cents:25000,status:'paid'}],
      receipts:[{id:'receipt-mock-001',charge_id:'charge-mock-001',amount_cents:25000,reference:'BANK-MOCK-001',received_at:'2026-10-15 12:00:00',actor_name:'HOMOLOGAÇÃO Admin'}]},
    'admin/control/overview':{ok:true,month:'2026-11',
      metrics:{grossContractedCents:119000,siteRecordedCents:119000,siteOutstandingCents:0,
        serviceRecordedCents:25000,serviceOutstandingCents:25000,expenseApprovedCents:18000,expensePaidCents:9000,
        expensePayableCents:9000,expenseOverdueCents:0,verifiedByImportedStatementCents:144000,
        matchedExpenseDebitsCents:9000,matchedRefundDebitsCents:0,classifiedNetMovementCents:135000,
        pendingCommissionsCents:11900,pendingDevelopersCents:35000,separatelyReportedPaidCommissionsCents:0,
        separatelyReportedPaidDevelopersCents:0,matchedCount:2},
      monthly:{bankMatchedInCents:144000,bankMatchedExpenseOutCents:9000,bankMatchedRefundOutCents:0,
        netClassifiedCents:135000,pendingSupplierBillsDueCents:9000,pendingServiceInvoicesDueCents:25000},
      exceptions:{commissionsWithRefunds:0,refundReviewsPending:0,unmatchedBankCredits:0},
      projects:[{id:'sale-handoff-demo-001',company:'Cliente Homologação UX',gross_cents:119000,received_cents:119000,
        commission_allocated_cents:11900,developer_allocated_cents:35000,direct_expense_cents:18000,estimatedContributionCents:54100}]},
    'admin/control/expenses':{ok:true,
      eligibleSales:[{id:'sale-handoff-demo-001',company:'Cliente Homologação UX',gross_cents:119000}],
      unassignedBankDebits:[{id:'bank-debit-qa-001',account_alias:'CONTA-QA',external_id:'BANK-DEBIT-QA-001',posted_on:'2026-11-06',
        amount_cents:-9000,description:'Pagamento de ferramenta'}],
      expenses:[{id:'expense-qa-001',supplier:'Software Exemplo',label:'Ferramenta de trabalho',category:'software',
        document_reference:'NOTA-QA-001',amount_cents:18000,paid_cents:9000,due_on:'2026-11-21',status:'partially_paid'}]},
    'admin/control/fiscal':{ok:true,
      documents:[{id:'fiscal-qa-001',source_kind:'sale',source_id:'sale-handoff-demo-001',
        issuer_name:'USBRIN HOMOLOGACAO',document_number:'NFS-QA-2026-01',issued_on:'2026-11-04',
        amount_cents:119000,status:'recorded'}],
      sources:{sale:[{id:'sale-handoff-demo-001',company:'Cliente Homologação UX',gross_cents:119000}],
        service_charge:[{id:'charge-mock-001',company:'Cliente Homologação UX',kind:'support',period:'2026-10',amount_cents:25000}],
        expense:[{id:'expense-qa-001',supplier:'Software Exemplo',document_reference:'NOTA-QA-001',amount_cents:18000}]}},
    'admin/bank/overview':{ok:true,batches:[{id:'batch-qa-001',account_alias:'CONTA-QA',filename:'sample.csv',sha_prefix:'123456789abc',row_count:2,created_at:'2026-11-06 00:00:00'}],
      totals:{credits_imported:1,debits_imported:1,matched_credits:1,unmatched_credits:0,pending_refunds:0,
        settled_refund_cents:0,unmatched_sale_receipts:0,unmatched_service_receipts:0},
      entries:[{id:'bank-credit-qa-001',account_alias:'CONTA-QA',external_id:'BANK-CREDIT-QA-001',posted_on:'2026-11-06',
        amount_cents:119000,description:'Site institucional',receipt_kind:'sale',receipt_id:'receipt-qa-001',match_status:'matched-receipt'}],
      matches:[{id:'match-qa-001',receipt_kind:'sale',receipt_id:'receipt-qa-001',external_id:'BANK-CREDIT-QA-001',account_alias:'CONTA-QA',amount_cents:119000}],
      unmatchedReceipts:[],refunds:[]},
    'crm/proposals':{ok:true,proposals:[{id:'mock-approved-quote-001',code:'Q0123456789ABC',opportunity_id:'mock-quote-op-1234',customer_company:'Empresa Demonstrativa',customer_contact:'Contato Comercial',scope:'Site institucional responsivo com cinco páginas, navegação, formulário de contato, revisão final e publicação orientada.',product:'business',price_cents:119000,duration_days:20,valid_until:'2027-02-20',terms:'O cronograma e o pagamento serão formalizados por contrato.',status:'approved',created_at:'2026-11-07 12:00:00',hosting_requested:1,support_requested:1,support_reference_monthly_cents:25000}]}
  },
  representante:{
    me:{ok:true,user:{name:'HOMOLOGAÇÃO Representante',role:'representante'}},
    'representante/dashboard':{ok:true,
      leads:[
        {id:'op-briefing-demo-001',company:'Cliente Homologação UX',contact:'Contato Exemplo',stage:'new',product:'Business',estimated_cents:119000,next_action:'Enviar demonstração do projeto',next_action_at:'2026-01-15',updated_at:'2026-11-01'},
        {id:'op-briefing-demo-002',company:'Studio Criativo QA',contact:'Responsável Estúdio',stage:'proposal',product:'Landing',estimated_cents:69000,next_action:null,next_action_at:null,updated_at:'2026-11-01'},
        {id:'op-briefing-demo-003',company:'Empresa de Referência',contact:'Gestor',stage:'negotiation',product:'Catálogo',estimated_cents:179000,next_action:'Conferir materiais',next_action_at:'2027-01-15',updated_at:'2026-11-07'}],
      commissions:[{id:'commission-qa-001',sale_id:'sale-qa-001',customer_company:'Cliente que contratou',basis_cents:119000,rate_bps:1500,amount_cents:17850,status:'due'}],
      proposals:[{id:'quote-qa-001',opportunity_id:'op-briefing-demo-002',status:'sent',price_cents:69000,valid_until:'2026-01-20',created_at:'2026-11-01'}],
      contracts:[{id:'sale-qa-001',opportunity_id:'op-briefing-demo-001',status:'paid',gross_cents:119000,received_cents:119000}],
      commissionRateBps:1500,leadCount:3,leadsTruncated:false,goals:[],sales:[]}
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
   window.fetch=async(input,options={})=>{
     const path=String(input);
     let result=null;
     if(path.includes('api/public-config'))result={ok:true,applicationsOpen:false,studioInquiriesOpen:false,turnstileSiteKey:null};
     else if(path.includes('/api/private/')){
       if(role==='expired')return Response.json({ok:false,code:'session_required'},{status:401});
       const endpoint=path.split('/api/private/')[1].split('?')[0];
       if(endpoint==='crm/proposal-draft'&&options.method==='POST'){
         window.__guideSubmitted=JSON.parse(options.body);
         result={ok:true,code:'QTESTGUIDED001',status:'draft'};
       }else if(endpoint==='crm/activity'&&options.method==='POST'){
         window.__commandActivity=JSON.parse(options.body);result={ok:true,id:'activity-qa-001'};
       }else if(endpoint==='crm/followup'&&options.method==='POST'){
         window.__commandFollowup=JSON.parse(options.body);result={ok:true};
       }else result=fixture[role]?.[endpoint]||{ok:false,error:'Endpoint não simulado'};
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
 const dims=await page.evaluate(()=>{
   const width=innerWidth;
   const offenders=Array.from(document.querySelectorAll('body *'))
     .filter(x=>{const r=x.getBoundingClientRect();return r.right>width+2||r.left< -2})
     .slice(0,6).map(x=>({tag:x.tagName,cls:String(x.className||'').slice(0,70),right:Math.round(x.getBoundingClientRect().right),text:x.textContent?.slice(0,36)}));
   const spills=Array.from(document.querySelectorAll('body *'))
     .filter(x=>x.scrollWidth>x.clientWidth+2)
     .slice(0,12)
     .map(x=>({tag:x.tagName,cls:String(x.className||'').slice(0,60),
       id:x.id,sw:x.scrollWidth,cw:x.clientWidth,overflow:getComputedStyle(x).overflowX}));
   return {body:document.body.scrollWidth,document:document.documentElement.scrollWidth,
     width,main:document.querySelector('main')?.getBoundingClientRect().right,offenders,spills};
 });
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
       const expected=role==='admin'?['overview','leads','guide','applications','studio','partners','projects','commissions','billing','bank']:role==='representante'?['overview','leads','guide','commissions']:['overview','projects','commissions'];
       assert.deepEqual(visible,expected,role+' navigation mismatch');
       if(role==='admin'){
         await page.locator('#portal-nav [data-view="partners"]').click();
         await page.locator('#partner-list').getByText('Nenhum registro disponível.',{exact:true}).waitFor({timeout:15000});
       }else if(role==='representante'){
         await page.locator('#rep-command').waitFor({state:'visible'});
         assert.equal(await page.locator('#cmd-priority-title').textContent(),'Cliente Homologação UX');
         assert.ok((await page.locator('#cmd-kpi-potential').textContent()).includes('R'));
         assert.ok((await page.locator('#cmd-comm-due').textContent()).includes('178,50'));
         assert.equal(await page.locator('.cmd-agenda-row').count(),3);
         await assertFits(page,'USBRIN Command representative '+width);
         await page.screenshot({path:resolve(outDir,'usbrin-command-'+width+'.png'),fullPage:true});
         await page.locator('#cmd-priority-actions').getByRole('button',{name:'Registrar contato'}).click();
         await page.locator('#cmd-quick-action textarea').fill('Conversamos sobre o projeto da empresa e seus materiais.');
         await page.locator('#cmd-quick-action').getByRole('button',{name:'Salvar'}).click();
         await page.waitForFunction(()=>Boolean(window.__commandActivity),{timeout:15000});
         const activity=await page.evaluate(()=>window.__commandActivity);
         assert.equal(activity.opportunityId,'op-briefing-demo-001');
         assert.equal(activity.kind,'contact');
         await page.locator('#cmd-priority-actions').getByRole('button',{name:'Agendar retorno'}).click();
         await page.locator('#cmd-quick-action input[type="text"]').fill('Enviar proposta aprovada');
         await page.locator('#cmd-quick-action input[type="date"]').fill('2027-02-10');
         await page.locator('#cmd-quick-action').getByRole('button',{name:'Salvar'}).click();
         await page.waitForFunction(()=>Boolean(window.__commandFollowup),{timeout:15000});
         const followup=await page.evaluate(()=>window.__commandFollowup);
         assert.equal(followup.date,'2027-02-10');
         await page.locator('#cmd-funnel .cmd-funnel-step').first().click();
         await page.locator('#view-leads').waitFor({state:'visible'});
       }else{
         await page.locator('#portal-nav [data-view="projects"]').click();
       }
       if(role==='admin'||role==='representante'){
         await page.locator('#portal-nav [data-view="guide"]').click();
         await page.locator('#view-guide').waitFor({state:'visible'});
         const cards=page.locator('.sales-plan');
         assert.equal(await cards.count(),3,'Three official plans required');
         const prices=await page.locator('.sales-price').allTextContents();
         assert.deepEqual(prices.map(x=>x.replaceAll(String.fromCharCode(160),' ')),['A partir de R$ 690','A partir de R$ 1.190','A partir de R$ 1.790']);
         assert.equal(await page.locator('#sales-checklist input[type="checkbox"]').count(),6);
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
         await page.locator('#guide-service-hosting').check();
         await page.locator('#guide-service-support').check();
         assert.ok((await page.locator('#guide-service-summary').innerText()).includes('R$ 250/mês'));
         assert.ok((await total.innerText()).includes('2.390'),'Monthly support cannot be added to the one-time quote');
         assert.ok((await page.locator('.guide-payments-policy').innerText()).includes('Pix'));

         await page.locator('#guide-brief-lead option').nth(1).waitFor({state:'attached'});
         await page.locator('#guide-brief-lead').selectOption('op-briefing-demo-001');
         await page.locator('#guide-brief-objective').fill('Apresentar os serviços e permitir orçamentos online.');
         await page.locator('#guide-brief-sections').fill('Página inicial, empresa, serviços, blog e contato.');
         await page.locator('#guide-brief-materials').fill('Cliente enviará logotipo e fotografias.');
         await page.locator('#guide-brief-duration').fill('21');
         await page.locator('#guide-brief-submit').click();
         await page.waitForFunction(()=>Boolean(window.__guideSubmitted),{timeout:15000});
         const draft=await page.evaluate(()=>window.__guideSubmitted);
         assert.equal(draft.opportunityId,'op-briefing-demo-001');
         assert.equal(draft.product,'catalogo');
         assert.equal(draft.priceCents,239000);
         assert.equal(draft.hostingRequested,true);
         assert.equal(draft.supportRequested,true);
         assert.ok(draft.scope.includes('hospedagem gerenciada'));
         assert.ok(draft.scope.includes('Suporte USBRIN mensal'));
         assert.ok(draft.terms.includes('representantes não estão autorizados a receber valores'));
         assert.ok(draft.scope.includes('Cliente enviará logotipo e fotografias.'));
         assert.ok(draft.scope.includes('Blog gerenciável'));
         await page.waitForFunction(()=>document.querySelector('#guide-brief-feedback')?.textContent?.includes('QTESTGUIDED001'),{timeout:15000});
         await page.locator('#sales-checklist input[type="checkbox"]').first().check();
         assert.ok((await page.locator('#sales-guide-progress').innerText()).includes('1 de 6'));
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
       if(role==='admin'){
         await page.locator('#portal-nav [data-view="projects"]').click();
         await page.locator('#project-sale option').nth(1).waitFor({state:'attached'});
         await page.locator('#project-sale').selectOption('sale-handoff-demo-001');
         assert.equal(await page.locator('#project-proposal-id').inputValue(),'proposal-approved-demo-001');
         assert.equal(await page.locator('#project-form textarea[name="description"]').isEditable(),false);
         assert.ok((await page.locator('#project-form textarea[name="description"]').inputValue()).includes('BRIEFING APROVADO'));
       }
       if(role==='admin'){
         await page.locator('#portal-nav [data-view="billing"]').click();
         await page.locator('#view-billing').waitFor({state:'visible'});
         await page.locator('#billing-agreements').getByText('Cliente Homologação UX',{exact:true}).first().waitFor();
         assert.ok((await page.locator('#billing-metrics').innerText()).includes('250,00'));
         assert.equal(await page.locator('#billing-sale option').count(),2);
         assert.equal(await page.locator('#billing-active-agreement option').count(),2);
         assert.equal(await page.locator('#billing-open-charge option').count(),2);
         assert.ok((await page.locator('#billing-receipts').innerText()).includes('BANK-MOCK-001'));
         assert.equal(await page.locator('#billing-agreement-form').isVisible(),true);
         assert.ok((await page.locator('#finance-main-metrics').innerText()).includes('1.190,00'));
         assert.ok((await page.locator('#finance-exceptions').innerText()).includes('Sem pendências identificadas'));
         assert.ok((await page.locator('#finance-expense-list').innerText()).includes('Software Exemplo'));
         assert.ok((await page.locator('#finance-project-margin').innerText()).includes('Cliente Homologação UX'));
         assert.ok((await page.locator('#finance-fiscal-list').innerText()).includes('NFS-QA-2026-01'));
         assert.equal(await page.locator('#finance-fiscal-source option').count(),2);
         await page.locator('#finance-fiscal-kind').selectOption('expense');
         assert.ok((await page.locator('#finance-fiscal-source').innerText()).includes('Software Exemplo'));
         await assertFits(page,'admin finance ledger '+width);
         await page.locator('#portal-nav [data-view="bank"]').click();
         await page.locator('#view-bank').waitFor({state:'visible'});
         await page.locator('#bank-entries').getByText('BANK-CREDIT-QA-001',{exact:true}).waitFor({timeout:15000});
         assert.ok((await page.locator('#bank-imports').innerText()).includes('sample.csv'));
         await assertFits(page,'admin reconciliation '+width);
       }else{
         assert.equal(await page.locator('#portal-nav [data-view="billing"]').isVisible(),false);
         assert.equal(await page.locator('#view-billing').isVisible(),false);
         assert.equal(await page.locator('#portal-nav [data-view="bank"]').isVisible(),false);
         assert.equal(await page.locator('#view-bank').isVisible(),false);
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
     await printed.page.locator('#proposal-optional-services').waitFor({state:'visible'});
     assert.ok((await printed.page.locator('#proposal-optional-services').innerText()).includes('R$ 250 por mês'));
     assert.ok((await printed.page.locator('#proposal-optional-services').innerText()).includes('preço e condições a definir'));
     assert.ok((await printed.page.locator('.payment-policy').innerText()).includes('Representantes comerciais não estão autorizados'));
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
   const identity=await pageFor('expired',width,recruitmentUrl);
   try{
     await identity.page.getByRole('link',{name:'Conheça as oportunidades'}).click();
     assert.ok(identity.page.url().endsWith('#oportunidades'));
     await identity.page.getByRole('link',{name:'Já sou parceiro'}).click();
     await identity.page.getByRole('heading',{name:'Bem-vindo de volta.'}).waitFor();
     assert.ok(identity.page.url().includes('/public/usbrin-id.html'));
     assert.equal(await identity.page.getByRole('link',{name:'Entrar com meu e-mail'}).getAttribute('href'),'/portal');
     await assertFits(identity.page,'USBRIN ID '+width);
     await identity.page.screenshot({path:resolve(outDir,'usbrin-id-'+width+'.png'),fullPage:true});
     await identity.page.goto(portalUrl);
     await identity.page.getByText('Sua sessão precisa ser verificada.',{exact:false}).waitFor();
     assert.equal(await identity.page.locator('#portal-content').isVisible(),false);
     assert.equal(await identity.page.getByRole('link',{name:'Tentar novamente'}).getAttribute('href'),'/portal');
     assert.deepEqual(identity.errors,[]);
     console.log('PASS USBRIN ID and expired session',width);
   }finally{await identity.context.close();}
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
