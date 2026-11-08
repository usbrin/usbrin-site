import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {onRequest as privateAPI} from "../functions/api/private/[[path]].js";
import {onRequestPost as apply} from "../functions/public/api/applications.js";
import {onRequestPost as studioInquiry} from "../functions/api/studio-inquiry.js";
import {onRequestGet as publicConfig} from "../functions/api/public-config.js";
import {onRequestPost as statusLookup} from "../functions/api/application-status.js";
import {authenticatedUser} from "../functions/_lib/auth.js";
import {readBody,checkOrigin} from "../functions/_lib/security.js";

class TestD1{
 constructor(){
   this.sqlite=new DatabaseSync(":memory:");
   for(const migration of ["migrations/0001_partners.sql","migrations/0002_financial_integrity.sql","migrations/0003_partner_contracts.sql","migrations/0004_studio_inquiries.sql","migrations/0005_studio_assignments.sql","migrations/0006_sale_project_links.sql","migrations/0007_atomic_receipts.sql","migrations/0008_crm_followups.sql","migrations/0009_proposal_drafts.sql","migrations/0010_project_proposal_handoff.sql","migrations/0011_optional_services.sql","migrations/0012_recurring_billing_controls.sql","migrations/0013_bank_evidence_and_refunds.sql"]){
     this.sqlite.exec(readFileSync(new URL("../"+migration,import.meta.url),"utf8"));
   }
 }
 prepare(sql){
   const ctx=this;
   return {sql,values:[],
     bind(...values){this.values=values;return this;},
     async first(){return ctx.sqlite.prepare(this.sql).get(...this.values)??null;},
     async all(){return {results:ctx.sqlite.prepare(this.sql).all(...this.values)};},
     async run(){const m=ctx.sqlite.prepare(this.sql).run(...this.values);return {meta:{changes:m.changes,last_row_id:m.lastInsertRowid?.toString()}};}
   };
 }
 async batch(stmts){
   const results=[];
   this.sqlite.exec("BEGIN");
   try{
     for(const stmt of stmts){
       if(/^\s*SELECT\b/i.test(stmt.sql))results.push(await stmt.all());
       else results.push(await stmt.run());
     }
     this.sqlite.exec("COMMIT");return results;
   }catch(e){this.sqlite.exec("ROLLBACK");throw e;}
 }
}

const encoder=new TextEncoder();
const b64=src=>Buffer.from(src).toString("base64url");
const domain="https://usbrin-tests.cloudflareaccess.com",audience="usbrin-partners-test-audience";
const {publicKey,privateKey}=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const jwk=await crypto.subtle.exportKey("jwk",publicKey);jwk.kid="partners-test-key";
const priorFetch=globalThis.fetch;
globalThis.fetch=async (url,options={})=>{
 if(String(url)===domain+"/cdn-cgi/access/certs")return new Response(JSON.stringify({keys:[jwk]}),{status:200});
 if(String(url).includes("challenges.cloudflare.com/turnstile/v0/siteverify")){
   const token=options.body?.get?.("response");
   if(token==="mock-replayed-token"){
     return Response.json({success:false,"error-codes":["timeout-or-duplicate"]});
   }
   if(token==="mock-other-host-token"){
     return Response.json({success:true,hostname:"other.example.test",action:"usbrin_application"});
   }
   const action=token==="mock-application-token"?"usbrin_application":token==="mock-studio-token"?"usbrin_studio":"usbrin_status";
   return new Response(JSON.stringify({success:true,hostname:"usbrin-preview.pages.dev",action}),{status:200});
 }
 return new Response("Not found",{status:404});
};
async function signed(email,options={}){
 const now=Math.floor(Date.now()/1000);
 const header=b64(JSON.stringify({alg:"RS256",typ:"JWT",kid:jwk.kid}));
 const payload=b64(JSON.stringify({iss:domain,aud:options.aud||audience,email,iat:now,exp:options.exp??now+3600}));
 const signing=header+"."+payload;
 const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",privateKey,encoder.encode(signing));
 return signing+"."+b64(Buffer.from(sig));
}
const db=new TestD1();
const users=[
 ["a1","admin@usbrin.test","Administrador","admin"],
 ["r1","representante1@usbrin.test","Representante 1","representante"],
 ["r2","representante2@usbrin.test","Representante 2","representante"],
 ["d1","dev1@usbrin.test","Desenvolvedor 1","desenvolvedor"],
 ["d2","dev2@usbrin.test","Desenvolvedor 2","desenvolvedor"]
];
for(const u of users)db.sqlite.prepare("INSERT INTO users(id,email,name,role,status) VALUES (?,?,?,?,'active')").run(...u);
const env={DB:db,ACCESS_TEAM_DOMAIN:domain,ACCESS_AUD:audience,APPLICATIONS_ENABLED:"false"};
async function call(email,route,data){
 const req=new Request("https://usbrin-preview.pages.dev/api/private/"+route,{method:data===undefined?"GET":"POST",headers:{"Cf-Access-Jwt-Assertion":await signed(email),...(data===undefined?{}:{"content-type":"application/json","origin":"https://usbrin-preview.pages.dev"})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 const res=await privateAPI({request:req,env});
 return {status:res.status,data:await res.json()};
}

test("public registration defaults to disabled, even with database",async()=>{
 const r=publicConfig({env});assert.equal((await r.json()).applicationsOpen,false);
 const req=new Request("https://usbrin-preview.pages.dev/public/api/applications",{method:"POST",headers:{"content-type":"application/json","origin":"https://usbrin-preview.pages.dev"},body:JSON.stringify({})});
 assert.equal((await apply({request:req,env})).status,503);
});

test("candidate forms require verified Turnstile, consent, and reject duplicate active applications",async()=>{
 const enabled={...env,APPLICATIONS_ENABLED:"true",TURNSTILE_SITE_KEY:"site-key-test",TURNSTILE_SECRET:"secret-test"};
 const body={type:"representante",name:"Profissional Exemplo",email:"candidato.teste@usbrin.test",phone:"69999999999",city:"Porto Velho",state:"RO",experience:"Atendimento comercial profissional e relacionamento com empresas",motivation:"Desejo contribuir com prospecção nacional e crescimento sustentável",availability:"Tardes",privacy:true,website:"",turnstileToken:"mock-application-token"};
 const request=(payload)=>new Request("https://usbrin-preview.pages.dev/public/api/applications",{method:"POST",headers:{"content-type":"application/json","origin":"https://usbrin-preview.pages.dev"},body:JSON.stringify(payload)});
 assert.equal((await apply({request:request({...body,privacy:false}),env:enabled})).status,400);
 for(const turnstileToken of ["","mock-status-token","mock-replayed-token","mock-other-host-token"]){
   assert.equal((await apply({request:request({...body,turnstileToken}),env:enabled})).status,403);
 }
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS total FROM applications WHERE email=?").get(body.email).total,0);
 const created=await apply({request:request(body),env:enabled});
 assert.equal(created.status,201);
 const content=await created.json();
 assert.match(content.protocol,/^U[A-F0-9]{13}$/);
 assert.equal((await apply({request:request(body),env:enabled})).status,409);
 const stored=db.sqlite.prepare("SELECT email,type,status FROM applications WHERE protocol=?").get(content.protocol);
 assert.equal(stored.email,body.email);assert.equal(stored.type,"representante");assert.equal(stored.status,"received");
});

test("Studio remains opt-in and CRM conversion is unique, authorized and traceable",async()=>{
 const disabledReq=new Request("https://usbrin-preview.pages.dev/api/studio-inquiry",{
   method:"POST",headers:{"content-type":"application/json","origin":"https://usbrin-preview.pages.dev"},body:"{}"
 });
 assert.equal((await studioInquiry({request:disabledReq,env})).status,503);
 const cfg=await publicConfig({env});assert.equal((await cfg.json()).studioInquiriesOpen,false);
 const enabled={...env,STUDIO_INQUIRIES_ENABLED:"true",TURNSTILE_SITE_KEY:"key-test",TURNSTILE_SECRET:"secret-test"};
 const body={idempotencyKey:crypto.randomUUID(),name:"Cliente demonstrativo",company:"Empresa Demonstrativa",
   email:"cliente@empresa.test",phone:"",goal:"Criar um site institucional profissional",notes:"Projeto de teste",
   briefing:"USBRIN Studio - Configuração de demonstração de um site institucional para apresentação de serviços.",product:"business",
   estimateCents:119000,consent:true,website:"",turnstileToken:"mock-studio-token"};
 const createReq=(data)=>new Request("https://usbrin-preview.pages.dev/api/studio-inquiry",{
   method:"POST",headers:{"content-type":"application/json","origin":"https://usbrin-preview.pages.dev"},body:JSON.stringify(data)
 });
 assert.equal((await studioInquiry({request:createReq({...body,consent:false}),env:enabled})).status,400);
 assert.equal((await studioInquiry({request:createReq({...body,turnstileToken:"mock-status-token"}),env:enabled})).status,403);
 const received=await studioInquiry({request:createReq(body),env:enabled});
 assert.equal(received.status,201);const saved=await received.json();assert.match(saved.protocol,/^S[A-F0-9]{13}$/);
 const retry=await studioInquiry({request:createReq(body),env:enabled});
 assert.equal(retry.status,200);assert.equal((await retry.json()).protocol,saved.protocol);
 const requests=await call(users[0][1],"admin/studio-inquiries");assert.equal(requests.status,200);
 const item=requests.data.inquiries.find(x=>x.protocol===saved.protocol);assert.ok(item);
 assert.equal(item.email,body.email);assert.equal(item.status,"new");
 assert.equal((await call(users[1][1],"admin/studio-inquiries")).status,404);
 const before=await call(users[0][1],"admin/overview");
 assert.ok(before.data.tasks.studioNew>=1);
 const invalid=await call(users[0][1],"admin/studio-status",{id:item.id,status:"closed",note:""});assert.equal(invalid.status,409);
 const changed=await call(users[0][1],"admin/studio-status",{id:item.id,status:"review",note:"Em análise"});assert.equal(changed.status,200);
 const assign=await call(users[0][1],"admin/studio-assign",{inquiryId:item.id,partnerId:"r1"});
 assert.equal(assign.status,200);
 const second=await call(users[0][1],"admin/studio-assign",{inquiryId:item.id,partnerId:"r2"});
 assert.equal(second.status,409);
 const linked=db.sqlite.prepare("SELECT COUNT(*) total FROM studio_inquiry_assignments WHERE inquiry_id=?").get(item.id);
 assert.equal(linked.total,1);
 const rep1=await call(users[1][1],"representante/dashboard");assert.ok(rep1.data.leads.some(x=>x.id===assign.data.opportunityId));
 const rep2=await call(users[2][1],"representante/dashboard");assert.ok(!rep2.data.leads.some(x=>x.id===assign.data.opportunityId));
 const contract=await call(users[0][1],"admin/sale",{opportunityId:assign.data.opportunityId,grossCents:119000,receivedCents:50000,reference:"TEST-STUDIO-DEPOSIT-001"});
 assert.equal(contract.status,200);
 const available=await call(users[0][1],"admin/sales");assert.equal(available.status,200);
 assert.ok(available.data.sales.some(x=>x.id===contract.data.saleId));
 const linkedProject=await call(users[0][1],"admin/project",{title:"Site Empresa Demonstrativa",description:"Projeto vinculado à solicitação de cliente e ao contrato recebido.",developerId:"d1",compensationCents:35000,saleId:contract.data.saleId,dueAt:"2026-12-20"});
 assert.equal(linkedProject.status,201);assert.equal(linkedProject.data.saleId,contract.data.saleId);
 const duplicateProject=await call(users[0][1],"admin/project",{title:"Site duplicado",description:"Tentativa de duplicar o projeto de contrato.",developerId:"d2",compensationCents:20000,saleId:contract.data.saleId});
 assert.equal(duplicateProject.status,409);
 const dev=await call(users[3][1],"desenvolvedor/dashboard");
 assert.ok(dev.data.projects.some(x=>x.id===linkedProject.data.id));
 const projectLink=db.sqlite.prepare("SELECT sale_id FROM projects WHERE id=?").get(linkedProject.data.id);
 assert.equal(projectLink.sale_id,contract.data.saleId);
});

test("authorization matrix isolates representatives, developers, and customer data",async()=>{
 const admin=users[0][1],rep1=users[1][1],rep2=users[2][1],dev1=users[3][1],dev2=users[4][1];
 // Each role is denied private endpoints outside its assigned duties.
 for(const target of ["admin/users","admin/applications","admin/finance","admin/overview","admin/studio-inquiries","admin/projects"]){
   assert.equal((await call(rep1,target)).status,404,"representative must not read "+target);
   assert.equal((await call(dev1,target)).status,404,"developer must not read "+target);
 }
 for(const target of ["representante/dashboard","desenvolvedor/dashboard"]){
   assert.equal((await call(admin,target)).status,404,"admin must not use partner-only "+target);
 }
 assert.equal((await call(dev1,"representante/dashboard")).status,404);
 assert.equal((await call(rep1,"desenvolvedor/dashboard")).status,404);
 const l1=await call(rep1,"representante/lead",{company:"Lead privado de Rep 1",contact:"Contato privado 1",estimatedCents:10000});
 const l2=await call(rep2,"representante/lead",{company:"Lead privado de Rep 2",contact:"Contato privado 2",estimatedCents:12000});
 assert.equal(l1.status,201);assert.equal(l2.status,201);
 const r1=await call(rep1,"representante/dashboard"),r2=await call(rep2,"representante/dashboard");
 assert.equal(r1.status,200);assert.equal(r2.status,200);
 assert.ok(r1.data.leads.some(x=>x.id===l1.data.id));
 assert.ok(!r1.data.leads.some(x=>x.id===l2.data.id));
 assert.ok(r2.data.leads.some(x=>x.id===l2.data.id));
 assert.ok(!r2.data.leads.some(x=>x.id===l1.data.id));
 assert.equal((await call(rep1,"representante/lead-stage",{id:l2.data.id,stage:"qualified"})).status,404);
 assert.equal((await call(dev1,"representante/lead-stage",{id:l1.data.id,stage:"qualified"})).status,404);
 const p1=await call(admin,"admin/project",{title:"Projeto privado Dev 1",description:"Entregas e dados de cliente exclusivos ao primeiro desenvolvedor.",developerId:"d1",compensationCents:9000});
 const p2=await call(admin,"admin/project",{title:"Projeto privado Dev 2",description:"Entregas e dados de cliente exclusivos ao segundo desenvolvedor.",developerId:"d2",compensationCents:9500});
 assert.equal(p1.status,201);assert.equal(p2.status,201);
 const d1=await call(dev1,"desenvolvedor/dashboard"),d2=await call(dev2,"desenvolvedor/dashboard");
 assert.ok(d1.data.projects.some(x=>x.id===p1.data.id));
 assert.ok(!d1.data.projects.some(x=>x.id===p2.data.id));
 assert.ok(d2.data.projects.some(x=>x.id===p2.data.id));
 assert.ok(!d2.data.projects.some(x=>x.id===p1.data.id));
 assert.equal((await call(dev1,"desenvolvedor/project",{id:p2.data.id,stage:"accepted"})).status,400);
 assert.equal((await call(rep1,"desenvolvedor/project",{id:p1.data.id,stage:"accepted"})).status,404);
 assert.equal((await call(dev1,"representante/lead",{company:"Empreendimento indevido",contact:"Contato indevido"})).status,404);
 assert.equal((await call(rep1,"admin/project",{title:"Projeto indevido",description:"Tentativa indevida de criação técnica",developerId:"d1",compensationCents:9000})).status,404);
 // CSRF protection applies even when a valid JWT is present.
 const withoutOrigin=new Request("https://usbrin-preview.pages.dev/api/private/representante/lead",{
   method:"POST",headers:{"Cf-Access-Jwt-Assertion":await signed(rep1),"content-type":"application/json"},
   body:JSON.stringify({company:"CSRF Teste",contact:"Contato Teste",estimatedCents:10000})
 });
 assert.equal((await privateAPI({request:withoutOrigin,env})).status,403);
 const foreignOrigin=new Request("https://usbrin-preview.pages.dev/api/private/representante/lead",{
   method:"POST",headers:{"Cf-Access-Jwt-Assertion":await signed(rep1),"content-type":"application/json","origin":"https://evil.example"},
   body:JSON.stringify({company:"CSRF Teste",contact:"Contato Teste",estimatedCents:10000})
 });
 assert.equal((await privateAPI({request:foreignOrigin,env})).status,403);
});


test("CRM follow-ups and activities are private, ordered and never turn into a sale",async()=>{
 const rep1=users[1][1],rep2=users[2][1],dev=users[3][1],admin=users[0][1];
 const lead=await call(rep1,"representante/lead",{company:"Empresa Teste CRM",contact:"Contato Responsável",estimatedCents:69000,nextAction:"Conversar sobre objetivos",nextActionAt:"2026-12-15"});
 assert.equal(lead.status,201);
 const id=lead.data.id;
 const invalidDate=await call(rep1,"crm/followup",{opportunityId:id,action:"Retorno futuro",date:"2026-02-30"});
 assert.equal(invalidDate.status,400);
 const update=await call(rep1,"crm/followup",{opportunityId:id,action:"Enviar demonstração inicial",date:"2026-12-16"});
 assert.equal(update.status,200);
 assert.equal((await call(rep2,"crm/followup",{opportunityId:id,action:"Tomar contato indevido",date:"2026-12-17"})).status,404);
 assert.equal((await call(dev,"crm/followup",{opportunityId:id,action:"Tentar contato",date:"2026-12-17"})).status,404);
 const note=await call(rep1,"crm/activity",{opportunityId:id,kind:"contact",note:"Cliente demonstrativo demonstrou interesse na landing."});
 assert.equal(note.status,201);
 assert.equal((await call(rep2,"crm/activity",{opportunityId:id,kind:"note",note:"Tentativa indevida"})).status,404);
 const history=await call(rep1,"crm/history?id="+id);
 assert.equal(history.status,200);
 assert.ok(history.data.activities.length>=2);
 assert.ok(history.data.activities.some(x=>x.kind==="contact"));
 assert.ok(history.data.activities.some(x=>x.kind==="followup"));
 assert.equal((await call(rep2,"crm/history?id="+id)).status,404);
 assert.equal((await call(dev,"crm/history?id="+id)).status,404);
 assert.equal((await call(admin,"crm/history?id="+id)).status,200);
 const row=db.sqlite.prepare("SELECT next_action,next_action_at,last_contact_at FROM opportunities WHERE id=?").get(id);
 assert.equal(row.next_action,"Enviar demonstração inicial");assert.equal(row.next_action_at,"2026-12-16");assert.ok(row.last_contact_at);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) total FROM sales WHERE opportunity_id=?").get(id).total,0);
 const won=await call(rep1,"representante/lead-stage",{id,stage:"lost"});
 assert.equal(won.status,400);
 const lost=await call(rep1,"representante/lead-stage",{id,stage:"lost",lostReason:"Cliente decidiu adiar o projeto"});
 assert.equal(lost.status,200);
 const recorded=db.sqlite.prepare("SELECT stage,lost_reason,next_action_at FROM opportunities WHERE id=?").get(id);
 assert.equal(recorded.stage,"lost");assert.equal(recorded.lost_reason,"Cliente decidiu adiar o projeto");assert.equal(recorded.next_action_at,null);
 assert.equal((await call(rep1,"crm/followup",{opportunityId:id,action:"Nova tarefa",date:"2026-12-20"})).status,409);
});

test("quote drafts require administrator approval and never create sales or disclose internal costs",async()=>{
 const rep=users[1][1],other=users[2][1],dev=users[3][1],admin=users[0][1];
 const lead=await call(rep,"representante/lead",{company:"Cliente teste propostas",contact:"Contato demonstração",estimatedCents:119000});
 assert.equal(lead.status,201);
 const id=lead.data.id,base={opportunityId:id,product:"business",scope:"Site institucional com cinco páginas, responsividade, contato e até duas rodadas de revisão.",priceCents:119000,durationDays:20,validUntil:"2027-02-20",terms:"Proposta sujeita a formalização e aceite."};
 assert.equal((await call(rep,"crm/proposal-draft",{...base,priceCents:0})).status,400);
 assert.equal((await call(other,"crm/proposal-draft",base)).status,404);
 assert.equal((await call(dev,"crm/proposal-draft",base)).status,404);
 const create=await call(rep,"crm/proposal-draft",base);
 assert.equal(create.status,201);assert.match(create.data.code,/^Q[A-F0-9]{13}$/);
 const proposalId=create.data.id;
 assert.equal((await call(other,"crm/proposals?id="+id)).status,404);
 assert.equal((await call(dev,"crm/proposals?id="+id)).status,404);
 const before=await call(rep,"crm/proposals?id="+id);
 assert.equal(before.status,200);assert.equal(before.data.proposals[0].status,"draft");
 assert.equal(Object.hasOwn(before.data.proposals[0],"cost_dev_cents"),false);
 const denied=await call(rep,"admin/proposal-review",{id:proposalId,decision:"approved",developerCents:20000,commissionCents:10000,taxCents:10000,otherCents:10000});
 assert.equal(denied.status,404);
 const over=await call(admin,"admin/proposal-review",{id:proposalId,decision:"approved",developerCents:110000,commissionCents:12000,taxCents:10000,otherCents:5000});
 assert.equal(over.status,409);
 const noCosts=await call(admin,"admin/proposal-review",{id:proposalId,decision:"approved",developerCents:35000});
 assert.equal(noCosts.status,400);
 const approve=await call(admin,"admin/proposal-review",{id:proposalId,decision:"approved",developerCents:35000,commissionCents:12000,taxCents:10000,otherCents:5000,note:"Custos revisados em homologação"});
 assert.equal(approve.status,200);assert.equal(approve.data.marginCents,57000);
 assert.equal((await call(admin,"admin/proposal-review",{id:proposalId,decision:"rejected",note:"Tentativa dupla"})).status,409);
 const visible=(await call(rep,"crm/proposals?id="+id)).data.proposals[0];
 assert.equal(visible.status,"approved");assert.equal(visible.customer_company,"Cliente teste propostas");
 assert.equal(Object.hasOwn(visible,"cost_commission_cents"),false);
 assert.equal((await call(admin,"admin/proposal-mark-sent",{id:proposalId})).status,400);
 assert.equal((await call(rep,"admin/proposal-mark-sent",{id:proposalId,confirmedExternally:true})).status,404);
 assert.equal((await call(admin,"admin/proposal-mark-sent",{id:proposalId,confirmedExternally:true})).status,200);
 assert.equal((await call(admin,"admin/proposal-mark-sent",{id:proposalId,confirmedExternally:true})).status,409);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM sales WHERE opportunity_id=?").get(id).n,0);
 const declinedDraft=await call(rep,"crm/proposal-draft",{...base,priceCents:150000});
 assert.equal(declinedDraft.status,201);
 const decline=await call(admin,"admin/proposal-review",{id:declinedDraft.data.id,decision:"rejected",note:"Refazer escopo e custos"});
 assert.equal(decline.status,200);
 const rows=db.sqlite.prepare("SELECT status FROM proposals WHERE opportunity_id=?").all(id).map(x=>x.status).sort();
 assert.deepEqual(rows,["rejected","sent"]);
 const cancelledLead=await call(rep,"representante/lead",{company:"Cliente encerrado teste",contact:"Contato encerrado",estimatedCents:69000});
 assert.equal(cancelledLead.status,201);
 const pending=await call(rep,"crm/proposal-draft",{...base,opportunityId:cancelledLead.data.id});
 assert.equal(pending.status,201);
 assert.equal((await call(rep,"representante/lead-stage",{id:cancelledLead.data.id,stage:"lost",lostReason:"Contato desistiu do projeto"})).status,200);
 assert.equal((await call(admin,"admin/proposal-review",{id:pending.data.id,decision:"approved",developerCents:0,commissionCents:0,taxCents:0,otherCents:0})).status,409);
});


test("approved client scope becomes the developer briefing only after received sale and admin assignment",async()=>{
 const rep=users[1][1],admin=users[0][1],dev=users[3][1];
 const lead=await call(rep,"representante/lead",{company:"HOMOLOGAÇÃO Cliente Integração",contact:"Contato Comercial",estimatedCents:119000});
 assert.equal(lead.status,201);
 const scope="BRIEFING COMERCIAL USBRIN — CONFERIR ANTES DA PRODUÇÃO\\nPlano: USBRIN Business\\nPáginas: 5\\nAdicionais: Blog gerenciável\\nObjetivo: apresentar os serviços\\nMateriais: identidade visual e textos serão entregues pelo cliente.";
 const payload={opportunityId:lead.data.id,product:"business",scope,priceCents:119000,durationDays:20,validUntil:"2027-03-01",terms:"Aprovação não é contrato."};
 const draft=await call(rep,"crm/proposal-draft",payload);assert.equal(draft.status,201);
 const approval=await call(admin,"admin/proposal-review",{id:draft.data.id,decision:"approved",developerCents:25000,commissionCents:10000,taxCents:10000,otherCents:5000});
 assert.equal(approval.status,200);
 const sale=await call(admin,"admin/sale",{opportunityId:lead.data.id,grossCents:119000,receivedCents:119000,reference:"BANK-TEST-HANDOFF-01"});
 assert.equal(sale.status,200);
 const eligible=await call(admin,"admin/sales");
 assert.equal(eligible.status,200);
 const listed=eligible.data.sales.find(s=>s.id===sale.data.saleId);
 assert.ok(listed);
 assert.equal(listed.approved_proposal_id,draft.data.id);
 assert.equal(listed.approved_scope,scope);
 const rejected=await call(rep,"admin/project",{title:"Indevido",description:scope,developerId:"d1",compensationCents:20000,saleId:sale.data.saleId,proposalId:draft.data.id});
 assert.equal(rejected.status,404);
 assert.equal((await call(admin,"admin/project",{title:"Projeto sem venda",description:scope,developerId:"d1",compensationCents:20000,proposalId:draft.data.id})).status,400);
 const anotherLead=await call(rep,"representante/lead",{company:"Outra empresa para teste",contact:"Outro contato",estimatedCents:119000});
 const otherDraft=await call(rep,"crm/proposal-draft",{...payload,opportunityId:anotherLead.data.id});
 assert.equal(otherDraft.status,201);
 assert.equal((await call(admin,"admin/proposal-review",{id:otherDraft.data.id,decision:"approved",developerCents:25000,commissionCents:10000,taxCents:10000,otherCents:5000})).status,200);
 assert.equal((await call(admin,"admin/project",{title:"Vinculo incorreto",description:scope,developerId:"d1",compensationCents:30000,saleId:sale.data.saleId,proposalId:otherDraft.data.id})).status,409);
 const project=await call(admin,"admin/project",{title:"Site institucional com blog",description:"TEXTO MODIFICADO NA INTERFACE",developerId:"d1",compensationCents:25000,saleId:sale.data.saleId,proposalId:draft.data.id});
 assert.equal(project.status,201);
 const technical=await call(dev,"desenvolvedor/dashboard");
 assert.equal(technical.status,200);
 const assigned=technical.data.projects.find(p=>p.id===project.data.id);
 assert.ok(assigned);assert.equal(assigned.description,scope);
 assert.equal(assigned.proposal_id,draft.data.id);
 assert.equal((await call(rep,"desenvolvedor/dashboard")).status,404);
 assert.equal((await call(admin,"admin/project",{title:"Duplicado",description:scope,developerId:"d1",compensationCents:25000,saleId:sale.data.saleId,proposalId:draft.data.id})).status,409);
});

test("special unpriced feature requests cannot be approved as standard-priced proposals",async()=>{
 const rep=users[1][1],admin=users[0][1];
 const lead=await call(rep,"representante/lead",{company:"Cliente com integração especial",contact:"Responsável CRM",estimatedCents:69000});
 const draft=await call(rep,"crm/proposal-draft",{opportunityId:lead.data.id,product:"personalizado",scope:"Loja com login, checkout e integração externa. Demanda precificação manual antes do envio.",priceCents:69000,durationDays:30,validUntil:"2027-03-01"});
 assert.equal(draft.status,201);
 const approval=await call(admin,"admin/proposal-review",{id:draft.data.id,decision:"approved",developerCents:0,commissionCents:0,taxCents:0,otherCents:0});
 assert.equal(approval.status,409);
 const check=await call(admin,"crm/proposals?id="+lead.data.id);
 assert.equal(check.data.proposals[0].status,"draft");
});

test("optional hosting and R$250 support remain outside setup revenue; only USBRIN admin handles payments",async()=>{
 const rep=users[1][1],other=users[2][1],dev=users[3][1],admin=users[0][1];
 const lead=await call(rep,"representante/lead",{company:"CLIENTE TESTE POS VENDA",contact:"Comprador Exemplo",estimatedCents:119000});
 assert.equal(lead.status,201);
 const payload={opportunityId:lead.data.id,product:"business",scope:"Site institucional com cinco páginas, formulário e materiais aprovados. Hospedagem e suporte à parte.",priceCents:119000,durationDays:15,validUntil:"2027-03-30",hostingRequested:true,supportRequested:true};
 assert.equal((await call(rep,"crm/proposal-draft",{...payload,hostingRequested:"true"})).status,400);
 const draft=await call(rep,"crm/proposal-draft",{...payload,supportMonthlyCents:999999,terms:"Pague por Pix no telefone particular do representante."});
 assert.equal(draft.status,201);
 const p=db.sqlite.prepare("SELECT price_cents,hosting_requested,support_requested,support_reference_monthly_cents,status,terms FROM proposals WHERE id=?").get(draft.data.id);
 assert.equal(p.price_cents,119000);
 assert.equal(p.hosting_requested,1);assert.equal(p.support_requested,1);
 assert.equal(p.support_reference_monthly_cents,25000);
 assert.equal(p.status,"draft");
 assert.ok(p.terms.includes("administração da USBRIN"),"representatives cannot set payment instructions");
 assert.ok(!p.terms.includes("telefone particular"),"unauthorized Pix instructions must not be persisted as payment terms");
 const visible=await call(rep,"crm/proposals?id="+lead.data.id);
 assert.equal(visible.status,200);
 assert.equal(visible.data.proposals[0].support_reference_monthly_cents,25000);
 assert.equal(Object.hasOwn(visible.data.proposals[0],"cost_dev_cents"),false);
 assert.equal((await call(other,"crm/proposals?id="+lead.data.id)).status,404);
 assert.equal((await call(dev,"crm/proposals?id="+lead.data.id)).status,404);
 // Front-end field hiding is not sufficient: server authorization denies all payment routes.
 for(const endpoint of ["admin/sale","admin/sale-receipt","admin/commission-status","admin/developer-payment-status"]){
   assert.equal((await call(rep,endpoint,{})).status,404,"representative cannot act on "+endpoint);
   assert.equal((await call(dev,endpoint,{})).status,404,"developer cannot act on "+endpoint);
 }
 const finance=await call(admin,"admin/finance");
 assert.equal(finance.status,200);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) total FROM sales WHERE opportunity_id=?").get(lead.data.id).total,0);
 const approved=await call(admin,"admin/proposal-review",{id:draft.data.id,decision:"approved",developerCents:35000,commissionCents:12000,taxCents:10000,otherCents:3000});
 assert.equal(approved.status,200);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) total FROM sales WHERE opportunity_id=?").get(lead.data.id).total,0);
 assert.equal(db.sqlite.prepare("SELECT support_reference_monthly_cents FROM proposals WHERE id=?").get(draft.data.id).support_reference_monthly_cents,25000);
 const plain=await call(rep,"crm/proposal-draft",{...payload,hostingRequested:false,supportRequested:false});
 assert.equal(plain.status,201);
 const standard=db.sqlite.prepare("SELECT hosting_requested,support_requested,support_reference_monthly_cents FROM proposals WHERE id=?").get(plain.data.id);
 assert.deepEqual([standard.hosting_requested,standard.support_requested,standard.support_reference_monthly_cents],[0,0,0]);
});


test("admin-only recurring-service ledger reconciles real receipts, blocks duplicates and protects immutable history",async()=>{
 const rep=users[1][1],dev=users[3][1],admin=users[0][1];
 assert.equal((await call(rep,"admin/billing/overview")).status,404);
 assert.equal((await call(dev,"admin/billing/overview")).status,404);
 const agreementBase={saleId:"",kind:"support",cadence:"monthly",amountCents:25000,startOn:"2026-11-01",
   contractReference:"SIGNED-SUPPORT-CASE-2026",termsSummary:"Suporte remoto dentro de horário comercial, duas pequenas alterações mensais e cancelamento conforme termo assinado.",confirmedSigned:true};
 assert.equal((await call(rep,"admin/billing/agreement",agreementBase)).status,404);
 const lead=await call(rep,"representante/lead",{company:"CLIENTE RECORRENTE TESTE 2026",contact:"Responsável de teste",estimatedCents:119000});
 assert.equal(lead.status,201);
 const sale=await call(admin,"admin/sale",{opportunityId:lead.data.id,grossCents:119000,receivedCents:0,reference:""});
 assert.equal(sale.status,200);
 const agreement={...agreementBase,saleId:sale.data.saleId};
 assert.equal((await call(admin,"admin/billing/agreement",agreement)).status,409,"service agreement requires fully received website sale");
 assert.equal((await call(admin,"admin/sale-receipt",{saleId:sale.data.saleId,amountCents:119000,reference:"WEBSITE-2026-TEST-PAID-01"})).status,200);
 assert.equal((await call(admin,"admin/billing/agreement",{...agreement,confirmedSigned:false})).status,400);
 assert.equal((await call(admin,"admin/billing/agreement",{...agreement,contractReference:"short"})).status,400);
 const created=await call(admin,"admin/billing/agreement",agreement);
 assert.equal(created.status,201);const id=created.data.id;
 assert.equal((await call(admin,"admin/billing/agreement",agreement)).status,409);
 assert.equal((await call(rep,"admin/billing/charge",{agreementId:id,period:"2026-11",dueOn:"2026-11-15",confirmedManual:true})).status,404);
 assert.equal((await call(dev,"admin/billing/receipt",{chargeId:"something",amountCents:1000,reference:"INTRUDER-001",confirmedBank:true})).status,404);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM service_charges WHERE agreement_id=?").get(id).n,0);
 const badDate=await call(admin,"admin/billing/charge",{agreementId:id,period:"2026-11",dueOn:"2026-12-10",confirmedManual:true});
 assert.equal(badDate.status,400);
 const charge=await call(admin,"admin/billing/charge",{agreementId:id,period:"2026-11",dueOn:"2026-11-15",confirmedManual:true});
 assert.equal(charge.status,201);
 assert.equal(charge.data.amountCents,25000);
 const chargeId=charge.data.id;
 assert.equal((await call(admin,"admin/billing/charge",{agreementId:id,period:"2026-11",dueOn:"2026-11-20",confirmedManual:true})).status,409);
 assert.equal((await call(admin,"admin/billing/receipt",{chargeId,amountCents:10000,reference:"UNCONFIRMED-2026",confirmedBank:false})).status,400);
 assert.equal((await call(admin,"admin/billing/receipt",{chargeId,amountCents:10000,reference:"WEBSITE-2026-TEST-PAID-01",confirmedBank:true})).status,409,"sale references must not be reusable for service payments");
 const first=await call(admin,"admin/billing/receipt",{chargeId,amountCents:10000,reference:"SUPPORT-BANK-2026-001",confirmedBank:true});
 assert.equal(first.status,200);assert.equal(first.data.receivedCents,10000);assert.equal(first.data.status,"partially_paid");
 assert.equal((await call(admin,"admin/billing/receipt",{chargeId,amountCents:10000,reference:"SUPPORT-BANK-2026-001",confirmedBank:true})).status,409);
 assert.equal((await call(admin,"admin/billing/receipt",{chargeId,amountCents:15001,reference:"SUPPORT-BANK-2026-OVERPAY",confirmedBank:true})).status,409);
 const second=await call(admin,"admin/billing/receipt",{chargeId,amountCents:15000,reference:"SUPPORT-BANK-2026-002",confirmedBank:true});
 assert.equal(second.status,200);assert.equal(second.data.status,"paid");assert.equal(second.data.receivedCents,25000);
 assert.equal((await call(admin,"admin/billing/receipt",{chargeId,amountCents:1,reference:"SUPPORT-BANK-2026-003",confirmedBank:true})).status,409);
 const dupSaleLead=await call(rep,"representante/lead",{company:"VENDA CRUZADA RECIBO TESTE",contact:"Contato 2",estimatedCents:69000});
 const secondSale=await call(admin,"admin/sale",{opportunityId:dupSaleLead.data.id,grossCents:69000,receivedCents:0,reference:""});
 assert.equal(secondSale.status,200);
 assert.equal((await call(admin,"admin/sale-receipt",{saleId:secondSale.data.saleId,amountCents:69000,reference:"SUPPORT-BANK-2026-002"})).status,409,"website receipt must not reuse service bank transaction");
 const overview=await call(admin,"admin/billing/overview");
 assert.equal(overview.status,200);
 const row=overview.data.charges.find(x=>x.id===chargeId);
 assert.equal(row.amount_cents,25000);assert.equal(row.received_cents,25000);
 assert.equal(overview.data.totals.receivedCents>=25000,true);
 assert.ok(overview.data.agreements.some(x=>x.id===id));
 assert.ok(overview.data.receipts.some(x=>x.reference==="SUPPORT-BANK-2026-001"));
 const audit=db.sqlite.prepare("SELECT COUNT(*) n FROM audit_events WHERE entity='service_charge' AND entity_id=?").get(chargeId).n;
 assert.ok(audit>=3);
 assert.throws(()=>db.sqlite.prepare("UPDATE service_receipts SET amount_cents=100 WHERE charge_id=?").run(chargeId),/immutable/);
 assert.throws(()=>db.sqlite.prepare("DELETE FROM service_receipts WHERE charge_id=?").run(chargeId),/immutable/);
 assert.throws(()=>db.sqlite.prepare("UPDATE service_charges SET amount_cents=1 WHERE id=?").run(chargeId),/immutable/);
 assert.throws(()=>db.sqlite.prepare("UPDATE service_agreements SET amount_cents=1 WHERE id=?").run(id),/immutable/);
 assert.equal((await call(admin,"admin/billing/agreement-status",{id,status:"paused",reason:"Revisão contratual pendente",confirmedReview:true})).status,200);
 assert.equal((await call(admin,"admin/billing/charge",{agreementId:id,period:"2026-12",dueOn:"2026-12-15",confirmedManual:true})).status,409);
 assert.equal((await call(admin,"admin/billing/agreement-status",{id,status:"active",reason:"Retomada após verificação assinada",confirmedReview:true})).status,200);
 const december=await call(admin,"admin/billing/charge",{agreementId:id,period:"2026-12",dueOn:"2026-12-15",confirmedManual:true});
 assert.equal(december.status,201);
 assert.equal((await call(admin,"admin/billing/agreement-status",{id,status:"cancelled",reason:"Rescisão formal confirmada",confirmedReview:true})).status,200);
 assert.equal((await call(admin,"admin/billing/agreement-status",{id,status:"active",reason:"Tentativa de reativação proibida",confirmedReview:true})).status,409);
 assert.equal((await call(admin,"admin/billing/charge",{agreementId:id,period:"2027-01",dueOn:"2027-01-15",confirmedManual:true})).status,409);
 const hosting=await call(admin,"admin/billing/agreement",{saleId:sale.data.saleId,kind:"hosting",cadence:"annual",amountCents:12000,startOn:"2026-11-01",
   contractReference:"HOSTING-AGREEMENT-SIGNED-2026",termsSummary:"Hospedagem gerenciada por período anual, domínio próprio contratado pelo cliente e renovações documentadas.",confirmedSigned:true});
 assert.equal(hosting.status,201);
 assert.equal((await call(admin,"admin/billing/charge",{agreementId:hosting.data.id,period:"2027-01",dueOn:"2027-01-15",confirmedManual:true})).status,400);
 const yearly=await call(admin,"admin/billing/charge",{agreementId:hosting.data.id,period:"2027",dueOn:"2027-01-15",confirmedManual:true});
 assert.equal(yearly.status,201);assert.equal(yearly.data.amountCents,12000);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM sales WHERE opportunity_id=?").get(lead.data.id).n,1,"recurring charges cannot create new website sales");
});

test("JWT requires a valid Cloudflare signature, correct audience and active user",async()=>{
 const missing=new Request("https://usbrin-preview.pages.dev/api/private/me");
 const response=await privateAPI({request:missing,env});
 assert.equal(response.status,403);
 const good=await signed(users[0][1]);const pieces=good.split(".");pieces[2]=(pieces[2][0]==="A"?"B":"A")+pieces[2].slice(1);const bad=pieces.join(".");
 for(const token of [bad,await signed(users[0][1],{aud:"wrong-audience"}),await signed(users[0][1],{exp:1})]){
   await assert.rejects(()=>authenticatedUser(new Request("https://usbrin-preview.pages.dev",{headers:{"Cf-Access-Jwt-Assertion":token}}),env));
 }
 const user=await authenticatedUser(new Request("https://usbrin-preview.pages.dev",{headers:{"Cf-Access-Jwt-Assertion":good}}),env);
 assert.equal(user.role,"admin");
 const unknown=await signed("not-approved@usbrin.test");
 await assert.rejects(()=>authenticatedUser(new Request("https://usbrin-preview.pages.dev",{headers:{"Cf-Access-Jwt-Assertion":unknown}}),env));
});

test("representatives cannot view administration and cannot change each other's opportunities",async()=>{
 const forbidden=await call(users[1][1],"admin/overview");assert.equal(forbidden.status,404);
 const created=await call(users[1][1],"representante/lead",{company:"Empresa Exemplo",contact:"Contato Autorizado",estimatedCents:119000,product:"Business"});
 assert.equal(created.status,201);const leadId=created.data.id;
 const foreign=await call(users[2][1],"representante/lead-stage",{id:leadId,stage:"qualified"});assert.equal(foreign.status,404);
 const self=await call(users[1][1],"representante/lead-stage",{id:leadId,stage:"qualified"});assert.equal(self.status,200);
 const dashboard=await call(users[2][1],"representante/dashboard");assert.equal(dashboard.status,200);
 assert.ok(dashboard.data.leads.every(lead=>lead.partner_id==="r2"),"representative 2 must never see another representative's leads");
 assert.ok(!dashboard.data.leads.some(lead=>lead.id===leadId),"representative 2 cannot see representative 1's lead");
});

test("records real partial receipts, refuses duplicates and creates commission only after full receipt",async()=>{
 const lead=await call(users[1][1],"representante/lead",{company:"Outro Exemplo",contact:"Cliente Dois",estimatedCents:119000});
 const start=await call(users[0][1],"admin/sale",{opportunityId:lead.data.id,grossCents:119000,receivedCents:50000,reference:"BANK-USBRIN-TEST-001"});
 assert.equal(start.status,200);assert.equal(start.data.status,"partially_paid");
 const premature=await call(users[0][1],"admin/commission",{saleId:start.data.saleId,rateBps:1500});assert.equal(premature.status,400);
 const duplicate=await call(users[0][1],"admin/sale-receipt",{saleId:start.data.saleId,amountCents:10000,reference:"BANK-USBRIN-TEST-001"});assert.equal(duplicate.status,409);
 const finish=await call(users[0][1],"admin/sale-receipt",{saleId:start.data.saleId,amountCents:69000,reference:"BANK-USBRIN-TEST-002"});
 assert.equal(finish.status,200);assert.equal(finish.data.status,"paid");
 const c=await call(users[0][1],"admin/commission",{saleId:start.data.saleId,rateBps:1500});
 assert.equal(c.status,200);assert.equal(c.data.amountCents,17850);
 const repeated=await call(users[0][1],"admin/commission",{saleId:start.data.saleId,rateBps:1500});assert.equal(repeated.status,409);
 const mark=await call(users[0][1],"admin/commission-status",{id:c.data.id,status:"approved"});assert.equal(mark.status,200);
 const due=await call(users[0][1],"admin/commission-status",{id:c.data.id,status:"due"});assert.equal(due.status,200);
 const withoutRef=await call(users[0][1],"admin/commission-status",{id:c.data.id,status:"paid"});assert.equal(withoutRef.status,400);
 const paid=await call(users[0][1],"admin/commission-status",{id:c.data.id,status:"paid",reference:"BANK-PAYMENT-001"});assert.equal(paid.status,200);
 const receipts=db.sqlite.prepare("SELECT sum(amount_cents) amount,count(*) n FROM sale_receipts WHERE sale_id=?").get(start.data.saleId);
 assert.equal(receipts.amount,119000);assert.equal(receipts.n,2);
 const rep=await call(users[1][1],"representante/dashboard");
 assert.equal(rep.data.commissions[0].status,"paid");
 assert.ok(rep.data.sales.reduce((n,x)=>n+x.amount_cents,0)>=119000); // A representative may have receipts from other tests/clients.
});

test("SQL receipt ledger prevents overpayment even with stale concurrent reads and blocks history edits",async()=>{
 const lead=await call(users[1][1],"representante/lead",{company:"Empresa Financeira Demo",contact:"Contato Financeiro",estimatedCents:69000});
 assert.equal(lead.status,201);
 const sale=await call(users[0][1],"admin/sale",{opportunityId:lead.data.id,grossCents:69000,receivedCents:25000,reference:"BANK-IMMUTABLE-001"});
 assert.equal(sale.status,200);
 let row=db.sqlite.prepare("SELECT status,received_cents FROM sales WHERE id=?").get(sale.data.saleId);
 assert.equal(row.received_cents,25000);assert.equal(row.status,"partially_paid");
 const add=await call(users[0][1],"admin/sale-receipt",{saleId:sale.data.saleId,amountCents:44000,reference:"BANK-IMMUTABLE-002"});
 assert.equal(add.status,200);assert.equal(add.data.receivedCents,69000);
 assert.throws(()=>{
   db.sqlite.prepare("INSERT INTO sale_receipts(id,sale_id,amount_cents,reference,actor_id) VALUES (?,?,?,?,?)")
   .run(crypto.randomUUID(),sale.data.saleId,1,"BANK-OVERPAID","a1");
 },/receipt exceeds payable balance/);
 const first=db.sqlite.prepare("SELECT id FROM sale_receipts WHERE sale_id=? LIMIT 1").get(sale.data.saleId);
 assert.throws(()=>db.sqlite.prepare("DELETE FROM sale_receipts WHERE id=?").run(first.id),/immutable/);
 assert.throws(()=>db.sqlite.prepare("UPDATE sale_receipts SET amount_cents=1 WHERE id=?").run(first.id),/immutable/);
 const receiptTotal=db.sqlite.prepare("SELECT SUM(amount_cents) total FROM sale_receipts WHERE sale_id=?").get(sale.data.saleId).total;
 row=db.sqlite.prepare("SELECT status,received_cents FROM sales WHERE id=?").get(sale.data.saleId);
 assert.equal(receiptTotal,69000);assert.equal(row.received_cents,69000);assert.equal(row.status,"paid");
});
test("developer access remains isolated and project transitions are guarded",async()=>{
 const create=await call(users[0][1],"admin/project",{title:"Site Projeto",description:"Construir uma página responsiva e acessível.",developerId:"d1",compensationCents:35000});
 assert.equal(create.status,201);const id=create.data.id;
 const other=await call(users[4][1],"desenvolvedor/project",{id,stage:"accepted"});assert.equal(other.status,400);
 const accept=await call(users[3][1],"desenvolvedor/project",{id,stage:"accepted"});assert.equal(accept.status,200);
 const jump=await call(users[3][1],"desenvolvedor/project",{id,stage:"review"});assert.equal(jump.status,400);
 assert.equal((await call(users[3][1],"desenvolvedor/project",{id,stage:"in_progress"})).status,200);
 assert.equal((await call(users[3][1],"desenvolvedor/project",{id,stage:"review",previewUrl:"https://example.com/preview"})).status,200);
 assert.equal((await call(users[0][1],"admin/project-stage",{id,stage:"approved"})).status,200);
 const backwards=await call(users[0][1],"admin/project-stage",{id,stage:"proposed"});assert.equal(backwards.status,409);
 const dev=await call(users[4][1],"desenvolvedor/dashboard");assert.equal(dev.status,200);
 assert.ok(dev.data.projects.every(project=>project.developer_id==="d2"),"developer 2 must only receive assigned projects");
 assert.ok(!dev.data.projects.some(project=>project.id===id),"developer 2 must not see developer 1's project");
});

test("applications cannot skip assessment and documentation",async()=>{
 const id="application-reviewed-2";
 db.sqlite.prepare("INSERT INTO applications(id,protocol,type,name,email,phone,city,state,experience,motivation,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'received',datetime('now'),datetime('now'))")
   .run(id,"U-TEST-REVIEW-002","desenvolvedor","Pessoa Candidata","developer-candidate@usbrin.test","69999999999","Porto Velho","RO","Experiência em desenvolvimento","Tenho experiência em projetos e qualidade visual.");
 assert.equal((await call(users[0][1],"admin/review",{id,status:"approved",note:""}) ).status,409);
 for(const next of ["review","preapproved","documentation","approved"]){
   assert.equal((await call(users[0][1],"admin/review",{id,status:next,note:"Documentação examinada."})).status,200);
 }
 assert.equal((await call(users[0][1],"admin/review",{id,status:"received",note:""}) ).status,409);
 const stored=db.sqlite.prepare("SELECT status FROM applications WHERE id=?").get(id);
 assert.equal(stored.status,"approved");
 const updated=await call(users[0][1],"admin/application-note",{id,note:"Avaliação interna: portfólio e referências conferidos."});
 assert.equal(updated.status,200);
 assert.equal((await call(users[1][1],"admin/application-note",{id,note:"Tentativa sem permissão"})).status,404);
 const savedNote=db.sqlite.prepare("SELECT reviewer_note FROM applications WHERE id=?").get(id).reviewer_note;
 assert.equal(savedNote,"Avaliação interna: portfólio e referências conferidos.");
});

test("partner activation requires an approved application and a traceable signed contract reference",async()=>{
 const id="app-reviewed-1";
 db.sqlite.prepare("INSERT INTO applications(id,protocol,type,name,email,phone,city,state,experience,motivation,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'approved',datetime('now'),datetime('now'))")
   .run(id,"U-TEST-APPROVED","representante","Parceiro de Teste","novo@usbrin.test","69999999999","Porto Velho","RO","Experiência comercial comprovada","Desejo conhecer e representar a USBRIN.");
 const attempt=await call(users[0][1],"admin/activate",{applicationId:id,contractVerified:true});
 assert.equal(attempt.status,400);
 const done=await call(users[0][1],"admin/activate",{applicationId:id,contractVerified:true,contractReference:"TEST-CONTRACT-SIGNED-2026-01"});
 assert.equal(done.status,200);
 const verified=db.sqlite.prepare("SELECT contract_reference,role,status FROM users WHERE email=?").get("novo@usbrin.test");
 assert.equal(verified.contract_reference,"TEST-CONTRACT-SIGNED-2026-01");
 assert.equal(verified.status,"active");
 const again=await call(users[0][1],"admin/activate",{applicationId:id,contractVerified:true,contractReference:"TEST-DUPLICATE"});
 assert.equal(again.status,409);
});

test("developer payments cannot exceed the approved contract or be marked paid without reference",async()=>{
 const project=await call(users[0][1],"admin/project",{title:"Landing demonstrativa",description:"Implementação responsiva acordada e aprovada",developerId:"d1",compensationCents:25000});
 assert.equal(project.status,201);const id=project.data.id;
 for(const stage of ["accepted","in_progress","review"]){
   assert.equal((await call(users[3][1],"desenvolvedor/project",{id,stage})).status,200);
 }
 assert.equal((await call(users[0][1],"admin/project-stage",{id,stage:"approved"})).status,200);
 const one=await call(users[0][1],"admin/developer-payment",{projectId:id,amountCents:20000,status:"pending"});
 assert.equal(one.status,200);
 const tooMuch=await call(users[0][1],"admin/developer-payment",{projectId:id,amountCents:10000,status:"pending"});
 assert.equal(tooMuch.status,400);
 assert.equal((await call(users[0][1],"admin/developer-payment-status",{id:one.data.id,status:"approved"})).status,200);
 assert.equal((await call(users[0][1],"admin/developer-payment-status",{id:one.data.id,status:"paid"})).status,400);
 assert.equal((await call(users[0][1],"admin/developer-payment-status",{id:one.data.id,status:"paid",reference:"TEST-DEV-PAYMENT-001"})).status,200);
 const receipt=db.sqlite.prepare("SELECT payment_reference FROM developer_payments WHERE id=?").get(one.data.id);
 assert.equal(receipt.payment_reference,"TEST-DEV-PAYMENT-001");
});

test("status lookup returns only selection progress after verified request",async()=>{
 const config={...env,APPLICATIONS_ENABLED:"true",TURNSTILE_SITE_KEY:"test-site",TURNSTILE_SECRET:"test-secret"};
 const body={protocol:"U-TEST-REVIEW-002",email:"developer-candidate@usbrin.test",turnstileToken:"a-valid-mocked-token"};
 // Protocols use a secure random hexadecimal identifier, so this fixture must follow the API format.
 db.sqlite.prepare("UPDATE applications SET protocol=? WHERE id=?").run("U123456789ABCD","application-reviewed-2");
 body.protocol="U123456789ABCD";
 const request=new Request("https://usbrin-preview.pages.dev/api/application-status",{method:"POST",headers:{"content-type":"application/json","origin":"https://usbrin-preview.pages.dev"},body:JSON.stringify(body)});
 const result=await statusLookup({request,env:config});
 const data=await result.json();
 assert.equal(result.status,200);assert.equal(data.status,"approved");
 assert.equal(Object.hasOwn(data,"name"),false);assert.equal(Object.hasOwn(data,"email"),false);
 const forged=new Request("https://usbrin-preview.pages.dev/api/application-status",{method:"POST",headers:{"content-type":"application/json","origin":"https://usbrin-preview.pages.dev"},body:JSON.stringify({...body,email:"other@usbrin.test"})});
 assert.equal((await statusLookup({request:forged,env:config})).status,404);
});
test("state validation and security helpers reject invalid content",async()=>{
 assert.equal(checkOrigin(new Request("https://usbrin-preview.pages.dev/test")),false);
 await assert.rejects(()=>readBody(new Request("https://usbrin-preview.pages.dev",{method:"POST",headers:{"content-type":"text/plain"},body:"hello"})));
});

test("admin can immediately revoke a partner session; only signed-contract partners may be reactivated",async()=>{
 const rep=users[2][1],dev=users[4][1],admin=users[0][1];
 assert.equal((await call(rep,"admin/partner-access",{userId:"r2",status:"suspended",reason:"Tentativa indevida"})).status,404);
 assert.equal((await call(admin,"admin/partner-access",{userId:"a1",status:"suspended",reason:"Administracao"})).status,404);
 assert.equal((await call(admin,"admin/partner-access",{userId:"r2",status:"suspended",reason:"curto"})).status,400);
 const revoked=await call(admin,"admin/partner-access",{userId:"r2",status:"suspended",reason:"Revisão da colaboração e acesso preventivo"});
 assert.equal(revoked.status,200);
 assert.equal((await call(rep,"representante/dashboard")).status,403);
 assert.equal((await call(rep,"representante/lead",{company:"Empresa X",contact:"Contato Y"})).status,403);
 assert.equal((await call(users[1][1],"representante/dashboard")).status,200);
 assert.equal((await call(dev,"desenvolvedor/dashboard")).status,200);
 const noContract=await call(admin,"admin/partner-access",{userId:"r2",status:"active",reason:"Retorno solicitado sem contrato"});
 assert.equal(noContract.status,409);
 db.sqlite.prepare("UPDATE users SET contract_reference=?,contract_verified_at=datetime('now') WHERE id='r2'").run("CONTRACT-REVIEWED-2026");
 const restored=await call(admin,"admin/partner-access",{userId:"r2",status:"active",reason:"Contrato e identidade reconfirmados"});
 assert.equal(restored.status,200);
 assert.equal((await call(rep,"representante/dashboard")).status,200);
 const suspendDev=await call(admin,"admin/partner-access",{userId:"d2",status:"suspended",reason:"Projeto finalizado e acesso encerrado"});
 assert.equal(suspendDev.status,200);
 assert.equal((await call(dev,"desenvolvedor/dashboard")).status,403);
 db.sqlite.prepare("UPDATE users SET contract_reference=?,contract_verified_at=datetime('now') WHERE id='d2'").run("DEVELOPER-CONTRACT-2026");
 assert.equal((await call(admin,"admin/partner-access",{userId:"d2",status:"active",reason:"Contrato de desenvolvedor verificado"})).status,200);
 assert.equal((await call(dev,"desenvolvedor/dashboard")).status,200);
 const data=await call(admin,"admin/users");assert.equal(data.status,200);
 assert.equal(data.data.users.find(x=>x.id==="r2").contract_ready,1);
 const history=db.sqlite.prepare("SELECT action,details FROM audit_events WHERE entity='user' AND entity_id='r2' AND action='partner.access' ORDER BY created_at").all();
 assert.equal(history.length,2);
 assert.ok(history.some(x=>x.details.includes("active -> suspended")));
 assert.ok(history.some(x=>x.details.includes("suspended -> active")));
});
