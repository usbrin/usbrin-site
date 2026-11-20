'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectProject}=require('../scripts/production-readiness.cjs');
const official='usbrin.com.br';
function fixture(){
 return {success:true,result:{
  name:'usbrin-site',domains:['usbrin-site.pages.dev',official],production_branch:'feature/usbrin-studio-mvp',
  deployment_configs:{production:{
   fail_open:false,d1_databases:{USBRIN_ID_DB:{id:'separate-production-d1-id'}},
   env_vars:{
    APPLICATIONS_ENABLED:{type:'plain_text',value:'false'},
    REPRESENTATIVE_APPLICATIONS_ENABLED:{type:'plain_text',value:'false'},
    REPRESENTATIVE_STATUS_ENABLED:{type:'plain_text',value:'true'},
    REPRESENTATIVE_APPLICATIONS_HOST:{type:'plain_text',value:official},
    USBRIN_AUTH_MODE:{type:'plain_text',value:'zitadel'},
    NATIVE_AUTH_HOST:{type:'plain_text',value:official},
    ZITADEL_API_URL:{type:'plain_text',value:'https://usbrin-id-rzf8mn.us1.zitadel.cloud'},
    ZITADEL_LOGIN_CLIENT_TOKEN:{type:'secret_text'},
    USBRIN_PASSWORD_PEPPER:{type:'secret_text'},
    TURNSTILE_SECRET:{type:'secret_text'},
    TURNSTILE_SITE_KEY:{type:'plain_text',value:'turnstile-public-key-qa-fiction'},
    ZITADEL_PASSWORD_RESET_ENABLED:{type:'plain_text',value:'false'}
   }
  }}
 }};
}
test('prelaunch gates accept complete mock configuration without enabling signup',()=>{
 const c=inspectProject(fixture());
 assert.equal(c.ready,true,JSON.stringify(c.issues));
});
test('campaign activation is separate from security-only prelaunch',()=>{
 const data=fixture();
 assert.equal(inspectProject(data,{stage:'campaign'}).ready,false);
 data.result.deployment_configs.production.env_vars.REPRESENTATIVE_APPLICATIONS_ENABLED.value='true';
 assert.equal(inspectProject(data,{stage:'campaign'}).ready,true);
 assert.equal(inspectProject(data,{stage:'prelaunch'}).ready,false);
});
test('existing Cloudflare production without D1, secrets and fail closed must be blocked',()=>{
 const data=fixture(),p=data.result.deployment_configs.production;
 p.fail_open=true;
 p.d1_databases={};
 p.env_vars={};
 const result=inspectProject(data);
 assert.equal(result.ready,false);
 assert.ok(result.issues.some(x=>x.includes('fail_open=false')));
 assert.ok(result.issues.some(x=>x.includes('USBRIN_ID_DB')));
 assert.ok(result.issues.some(x=>x.includes('Turnstile')));
});
test('QA database must NEVER be accepted as the production binding',()=>{
 const data=fixture();
 data.result.deployment_configs.production.d1_databases.USBRIN_ID_DB.id='1998f0a6-bb45-4aba-b862-a30368da632c';
 assert.equal(inspectProject(data).ready,false);
});
test('custom domain and ZITADEL host are required to be exact',()=>{
 const data=fixture();
 data.result.deployment_configs.production.env_vars.NATIVE_AUTH_HOST.value='usbrin-id-native-qa.pages.dev';
 data.result.deployment_configs.production.env_vars.REPRESENTATIVE_APPLICATIONS_HOST.value='sub.usbrin.com.br';
 assert.equal(inspectProject(data).ready,false);
});
test('all account and token credentials must be secrets, never plaintext',()=>{
 const data=fixture(),vars=data.result.deployment_configs.production.env_vars;
 vars.ZITADEL_LOGIN_CLIENT_TOKEN.type='plain_text';
 vars.TURNSTILE_SECRET.type='plain_text';
 vars.USBRIN_PASSWORD_PEPPER.type='plain_text';
 const result=inspectProject(data);
 assert.equal(result.ready,false);
 assert.ok(result.issues.some(x=>x.includes('ZITADEL login client token')));
 assert.ok(result.issues.some(x=>x.includes('Turnstile validation key')));
 assert.ok(result.issues.some(x=>x.includes('pepper')));
});
test('unknown target project and unapproved mode cannot pass',()=>{
 const data=fixture();
 data.result.name='usbrin-id-native-qa';
 data.result.deployment_configs.production.env_vars.USBRIN_AUTH_MODE.value='native';
 assert.equal(inspectProject(data).ready,false);
});
test('global applications enabled would launch developers and must be rejected',()=>{
 const data=fixture();
 data.result.deployment_configs.production.env_vars.APPLICATIONS_ENABLED.value='true';
 assert.equal(inspectProject(data,{stage:'campaign'}).ready,false);
});
