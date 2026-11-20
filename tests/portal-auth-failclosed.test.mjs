import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as gate} from '../functions/_middleware.js';

const BASE='https://usbrin-id-native-qa.pages.dev';
const noAuth=Object.freeze({});
function context(path,env=noAuth,method='GET'){
  const url=BASE+path;
  let served=0;
  return {
    request:new Request(url,{method}),
    env,
    async next(){served++;return new Response('<script>private portal contents</script>',{status:200,headers:{'content-type':'text/html'}})},
    get served(){return served}
  };
}
for(const path of [
  '/portal','/portal/','/portal.html',
  '/proposta','/proposta/','/proposta.html',
  '/js/portal.js','/js/proposta.js'
]){
 test('deny private resource without configured auth: '+path,async()=>{
   const c=context(path);
   const response=await gate(c);
   assert.equal(response.status,503);
   assert.equal(c.served,0,'Never read private static asset before authentication');
   assert.equal(response.headers.get('cache-control'),'no-store, private');
   assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
   assert.doesNotMatch(await response.text(),/private portal contents/);
 });
}
test('deny private resource with invalid Zitadel backend configuration',async()=>{
 const c=context('/portal',{USBRIN_AUTH_MODE:'zitadel'});
 const response=await gate(c);
 assert.equal(response.status,503);
 assert.equal(c.served,0);
});
test('deny private resource with unready native configuration',async()=>{
 const c=context('/js/portal.js',{USBRIN_AUTH_MODE:'native'});
 const response=await gate(c);
 assert.equal(response.status,503);
 assert.equal(c.served,0);
});
test('unprotected public site and campaign remain accessible even without auth',async()=>{
 for(const path of ['/','/studio','/portfolio','/parceiros','/candidatura']){
   const c=context(path);
   const response=await gate(c);
   assert.equal(response.status,200,path);
   assert.equal(c.served,1);
 }
});
test('private application content is never emitted for unknown auth-mode values',async()=>{
 const c=context('/portal.html',{USBRIN_AUTH_MODE:'misconfigured'});
 const response=await gate(c);
 assert.equal(response.status,503);
 assert.equal(c.served,0);
});
