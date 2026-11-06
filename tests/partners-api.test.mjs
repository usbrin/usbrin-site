import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {onRequest as privateAPI} from "../functions/api/private/[[path]].js";
import {onRequestPost as apply} from "../functions/api/applications.js";
import {onRequestPost as studioInquiry} from "../functions/api/studio-inquiry.js";
import {onRequestGet as publicConfig} from "../functions/api/public-config.js";
import {onRequestPost as statusLookup} from "../functions/api/application-status.js";
import {authenticatedUser} from "../functions/_lib/auth.js";
import {readBody,checkOrigin} from "../functions/_lib/security.js";

class TestD1{
 constructor(){
   this.sqlite=new DatabaseSync(":memory:");
   for(const migration of ["migrations/0001_partners.sql","migrations/0002_financial_integrity.sql","migrations/0003_partner_contracts.sql","migrations/0004_studio_inquiries.sql","migrations/0005_studio_assignments.sql","migrations/0006_sale_project_links.sql"]){
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
 const req=new Request("https://usbrin-preview.pages.dev/api/applications",{method:"POST",headers:{"content-type":"application/json","origin":"https://usbrin-preview.pages.dev"},body:JSON.stringify({})});
 assert.equal((await apply({request:req,env})).status,503);
});

test("candidate forms require verified Turnstile, consent, and reject duplicate active applications",async()=>{
 const enabled={...env,APPLICATIONS_ENABLED:"true",TURNSTILE_SITE_KEY:"site-key-test",TURNSTILE_SECRET:"secret-test"};
 const body={type:"representante",name:"Profissional Exemplo",email:"candidato.teste@usbrin.test",phone:"69999999999",city:"Porto Velho",state:"RO",experience:"Atendimento comercial profissional e relacionamento com empresas",motivation:"Desejo contribuir com prospecção nacional e crescimento sustentável",availability:"Tardes",privacy:true,website:"",turnstileToken:"mock-application-token"};
 const request=(payload)=>new Request("https://usbrin-preview.pages.dev/api/applications",{method:"POST",headers:{"content-type":"application/json","origin":"https://usbrin-preview.pages.dev"},body:JSON.stringify(payload)});
 assert.equal((await apply({request:request({...body,privacy:false}),env:enabled})).status,400);
 assert.equal((await apply({request:request({...body,turnstileToken:"mock-status-token"}),env:enabled})).status,403);
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
 const dashboard=await call(users[2][1],"representante/dashboard");assert.deepEqual(dashboard.data.leads,[]);
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
 assert.equal(rep.data.sales.reduce((n,x)=>n+x.amount_cents,0),119000);
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
 const dev=await call(users[4][1],"desenvolvedor/dashboard");assert.deepEqual(dev.data.projects,[]);
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
