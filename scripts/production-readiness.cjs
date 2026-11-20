'use strict';
// A read-only release gate. Provide the Cloudflare Pages GET project response on stdin:
//   curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \\
//     "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/usbrin-site" \\
//     | node scripts/production-readiness.cjs
// No API writes; never echoes token or the value of secret variables.
const fs=require('node:fs');
const expectedOrigin='https://usbrin-id-rzf8mn.us1.zitadel.cloud';
const expectedHost='usbrin.com.br';
const qaDbIds=new Set([
  '1998f0a6-bb45-4aba-b862-a30368da632c',
  '98b82013-9285-4bd8-8957-453e660ab787',
  '82006ee4-6f1d-49f1-8ce7-98760ad79c82',
  '1cc6bebd-72db-4c17-b598-4e387bd3ac39',
  '206ab05a-dd37-4df3-a030-5ae7c18e3b46'
]);
function inspectProject(raw,{stage='prelaunch'}={}){
  const project=raw?.result||raw||{};
  const issues=[];
  const missing=(ok,reason)=>{if(!ok)issues.push(reason)};
  const prod=project.deployment_configs?.production||{};
  const v=prod.env_vars||{};
  const exact=(name,value)=>v[name]?.type==='plain_text'&&v[name]?.value===value;
  const secret=name=>v[name]?.type==='secret_text';
  const binding=prod.d1_databases?.USBRIN_ID_DB;
  missing(stage==='prelaunch'||stage==='campaign','Stage must be prelaunch or campaign');
  missing(project.name==='usbrin-site','Target must be the official usbrin-site Pages project');
  missing(Array.isArray(project.domains)&&project.domains.includes(expectedHost),
    'Official custom domain must be attached to this project');
  missing(project.production_branch==='feature/usbrin-studio-mvp',
    'Production branch has changed; review before release');
  missing(prod.fail_open===false,'Production functions must fail closed (fail_open=false)');
  missing(Boolean(binding?.id)&&!qaDbIds.has(binding?.id),
    'USBRIN_ID_DB must bind a separate non-QA D1 database');
  missing(exact('USBRIN_AUTH_MODE','zitadel'),'Authentication mode must be zitadel');
  missing(exact('NATIVE_AUTH_HOST',expectedHost),'Authentication host must be usbrin.com.br');
  missing(exact('ZITADEL_API_URL',expectedOrigin),'ZITADEL API origin must match approved instance');
  missing(secret('ZITADEL_LOGIN_CLIENT_TOKEN'),'ZITADEL login client token must be an encrypted secret');
  missing(secret('USBRIN_PASSWORD_PEPPER'),'Password limiter pepper must be an encrypted secret');
  missing(secret('TURNSTILE_SECRET'),'Turnstile validation key must be an encrypted secret');
  missing(v.TURNSTILE_SITE_KEY?.type==='plain_text'&&
    typeof v.TURNSTILE_SITE_KEY.value==='string'&&v.TURNSTILE_SITE_KEY.value.length>=8,
    'Turnstile public site key must be configured');
  missing(exact('REPRESENTATIVE_APPLICATIONS_HOST',expectedHost),
    'Representative application host must exactly equal usbrin.com.br');
  missing(exact('APPLICATIONS_ENABLED','false'),
    'Global applications must be explicitly false (developers stay closed)');
  missing(exact('REPRESENTATIVE_STATUS_ENABLED','true'),
    'Candidate status lookup must remain available after campaign closure');
  missing(exact('REPRESENTATIVE_APPLICATIONS_ENABLED',stage==='campaign'?'true':'false'),
    'Representative enrollment flag must match the requested release stage');
  missing(exact('ZITADEL_PASSWORD_RESET_ENABLED','false')||
    exact('ZITADEL_PASSWORD_RESET_ENABLED','true'),
    'Password recovery needs an explicit verified policy flag');
  return {ready:issues.length===0,stage,issues};
}
function main(){
  const stage=process.argv.includes('--campaign')?'campaign':'prelaunch';
  let data;
  try{data=JSON.parse(fs.readFileSync(0,'utf8'));}
  catch{console.error('FAIL: Cloudflare Pages project JSON required on stdin');process.exitCode=2;return;}
  const out=inspectProject(data,{stage});
  if(!out.ready){console.error('BLOCKED ('+stage+')');for(const issue of out.issues)console.error(' - '+issue);process.exitCode=1;return;}
  console.log('CONFIGURATION CHECK PASSED ('+stage+')');
  console.log('Still required: verified migrations, admin TOTP, real form/Turnstile, email and rollback testing, explicit release approval.');
}
if(require.main===module)main();
module.exports={inspectProject};
