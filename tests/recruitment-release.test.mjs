import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as publicConfig} from '../functions/api/public-config.js';
import {onRequestPost as createApplication} from '../functions/api/applications.js';
import {onRequestPost as applicationStatus} from '../functions/api/application-status.js';

const HOST='https://usbrin-preview.pages.dev';
function env(extra={}){
  const applications=[];
  const db={
    applications,
    batch:async queries=>{
      for(const query of queries){
        if(query.sql.includes('INSERT INTO applications')){
          const [id,protocol,type,name,email,phone,city,state,experience,motivation,portfolio,availability]=query.args;
          if(applications.some(a=>a.email===email&&a.type===type))
            throw Error('UNIQUE constraint failed: applications.email, applications.type');
          applications.push({id,protocol,type,name,email,phone,city,state,experience,motivation,portfolio,availability,status:'received',updated_at:'2026-11-19'});
        }
      }
      return [];
    },
    prepare:sql=>({sql,args:[],bind(...args){this.args=args;return this;},
      async first(){
        if(!this.sql.includes('FROM applications'))throw Error('Unexpected SELECT');
        const [protocol,mail,allowAll]=this.args;
        const found=applications.find(a=>a.protocol===protocol&&a.email===mail&&(allowAll||a.type==='representante'));
        return found?{status:found.status,updated_at:found.updated_at}:null;
      }
    })
  };
  return {APPLICATIONS_ENABLED:'false',USBRIN_ID_DB:db,
    TURNSTILE_SITE_KEY:'qa-only-public-key',
    TURNSTILE_SECRET:'qa-only-private-key',
    REPRESENTATIVE_APPLICATIONS_ENABLED:'false',
    REPRESENTATIVE_APPLICATIONS_HOST:'usbrin-preview.pages.dev',
    ...extra};
}
const body={
  type:'representante',name:'Pessoa Demonstrativa',email:'candidate.qa@domain.example',
  phone:'69999999999',city:'Porto Velho',state:'RO',
  experience:'Atendimento comercial a empresas em diferentes segmentos.',
  motivation:'Pretendo prospectar lojas e apresentar projetos de sites profissionais.',
  website:'',privacy:true,turnstileToken:'synthetic-turnstile-token'
};
const request=(pathname,bodyData,origin=HOST)=>new Request(origin+pathname,{
  method:'POST',
  headers:{'origin':origin,'content-type':'application/json'},
  body:JSON.stringify(bodyData)
});
const savedFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  if(String(url)!=='https://challenges.cloudflare.com/turnstile/v0/siteverify')throw Error('Unexpected fetch target');
  const action=options.body.get('response')==='status-test-token'?'usbrin_status':'usbrin_application';
  return Response.json({success:true,hostname:'usbrin-preview.pages.dev',action});
};
test.after(()=>{globalThis.fetch=savedFetch;});

test('recruitment stays fully closed by default even if D1 and Turnstile exist',async()=>{
  const e=env();
  const config=await publicConfig({env:e,request:request('/api/public-config',{})}).json();
  assert.equal(config.applicationsOpen,false);
  assert.deepEqual(config.applicationTypes,[]);
  const result=await createApplication({env:e,request:request('/api/applications',body)});
  assert.equal(result.status,503);
  assert.equal(e.USBRIN_ID_DB.applications.length,0);
});

test('representative-only opening is bound to the exact authorized host',async()=>{
  const e=env({REPRESENTATIVE_APPLICATIONS_ENABLED:'true'});
  const publicPage=(await publicConfig({env:e,request:new Request(HOST+'/api/public-config')})).json();
  assert.equal((await publicPage).applicationsOpen,true);
  assert.deepEqual((await publicPage).applicationTypes,['representante']);
  assert.equal((await publicPage).representativePreview,false);
  const unknown=(await publicConfig({env:e,request:new Request('https://another-domain.pages.dev/api/public-config')})).json();
  assert.equal((await unknown).applicationsOpen,false);
  assert.equal((await createApplication({env:e,request:request('/api/applications',{...body,type:'desenvolvedor'})})).status,503);
  assert.equal((await createApplication({env:e,request:request('/api/applications',body,'https://another-domain.pages.dev')})).status,503);
  assert.equal(e.USBRIN_ID_DB.applications.length,0);
});

test('candidate requires privacy consent, Turnstile and same-origin before persistence',async()=>{
  const e=env({REPRESENTATIVE_APPLICATIONS_ENABLED:'true'});
  for(const candidate of [
    {...body,privacy:false},
    {...body,website:'bot field'},
    {...body,turnstileToken:''}
  ]) {
    const r=await createApplication({env:e,request:request('/api/applications',candidate)});
    assert.ok([400,403].includes(r.status));
  }
  const attacker=new Request(HOST+'/api/applications',{method:'POST',
    headers:{origin:'https://attacker.invalid','content-type':'application/json'},
    body:JSON.stringify(body)});
  assert.equal((await createApplication({env:e,request:attacker})).status,403);
  assert.equal(e.USBRIN_ID_DB.applications.length,0);
});

test('approved representative-only mode receives applications, permits protocol status lookup, without creating accounts',async()=>{
  const e=env({REPRESENTATIVE_APPLICATIONS_ENABLED:'true'});
  const created=await createApplication({env:e,request:request('/api/applications',body)});
  assert.equal(created.status,201);
  const data=await created.json();
  assert.match(data.protocol,/^U[A-F0-9]{13}$/);
  assert.equal(data.status,'received');
  assert.equal(e.USBRIN_ID_DB.applications.length,1);
  assert.equal(e.USBRIN_ID_DB.applications[0].email,body.email);
  assert.equal((await createApplication({env:e,request:request('/api/applications',body)})).status,409);
  const status=await applicationStatus({env:e,request:request('/api/application-status',{
    protocol:data.protocol,email:body.email,turnstileToken:'status-test-token'
  })});
  assert.equal(status.status,200);
  assert.equal((await status.json()).status,'received');
});


test('existing candidates can track protocol after representative signup closes',async()=>{
  const e=env({REPRESENTATIVE_APPLICATIONS_ENABLED:'true'});
  const created=await createApplication({env:e,request:request('/api/applications',body)});
  assert.equal(created.status,201);
  const protocol=(await created.json()).protocol;
  e.REPRESENTATIVE_APPLICATIONS_ENABLED='false';
  e.REPRESENTATIVE_STATUS_ENABLED='true';
  const cfg=await publicConfig({env:e,request:new Request(HOST+'/api/public-config')}).json();
  assert.equal(cfg.applicationsOpen,false);
  assert.equal(cfg.applicationStatusOpen,true);
  assert.deepEqual(cfg.applicationTypes,[]);
  const newCandidate=await createApplication({env:e,request:request('/api/applications',{
    ...body,email:'another.candidate@domain.example'
  })});
  assert.equal(newCandidate.status,503);
  const existing=await applicationStatus({env:e,request:request('/api/application-status',{
    protocol,email:body.email,turnstileToken:'status-test-token'
  })});
  assert.equal(existing.status,200);
  assert.equal((await existing.json()).status,'received');
  // A preview/foreign host cannot inspect campaign records even with a valid protocol.
  const foreign=await applicationStatus({env:e,request:request('/api/application-status',{
    protocol,email:body.email,turnstileToken:'status-test-token'
  },'https://another-domain.pages.dev')});
  assert.equal(foreign.status,503);
});
