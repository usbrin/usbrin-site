import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as publicConfig} from '../functions/api/native/config.js';

test('ZITADEL password recovery must stay disabled by default',async()=>{
  const env={USBRIN_AUTH_MODE:'zitadel'};
  const request=new Request('https://usbrin-id-native-qa.pages.dev/api/native/config');
  const response=publicConfig({request,env});
  assert.equal((await response.json()).passwordRecovery,false);
});

import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequest as requestReset} from '../functions/api/native/password/request.js';
import {onRequest as confirmReset} from '../functions/api/native/password/confirm.js';

class Database {
 constructor(){
  this.sqlite=new DatabaseSync(':memory:');
  for(const name of ['0001_partners.sql','0018_native_password_links.sql','0019_zitadel_identity_sessions.sql']){
    this.sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  }
 }
 prepare(sql){
  const db=this.sqlite;
  return {sql,args:[],bind(...args){this.args=args;return this;},
    async first(){return db.prepare(this.sql).get(...this.args)||null;},
    async run(){const r=db.prepare(this.sql).run(...this.args);return {meta:{changes:r.changes}};}
  };
 }
 async batch(stmts){
  this.sqlite.exec('BEGIN');
  try{let out=[];for(const s of stmts)out.push(await s.run());
    this.sqlite.exec('COMMIT');return out;
  }catch(e){this.sqlite.exec('ROLLBACK');throw e;}
 }
}
const base='https://usbrin-id-native-qa.pages.dev';
function environment(db,options={}){
 return {USBRIN_AUTH_MODE:'zitadel',USBRIN_ID_DB:db,
  NATIVE_AUTH_HOST:'usbrin-id-native-qa.pages.dev',
  ZITADEL_API_URL:'https://usbrin-id-rzf8mn.us1.zitadel.cloud',
  ZITADEL_LOGIN_CLIENT_TOKEN:'synthetic-login-client-placeholder-2026',
  ZITADEL_PASSWORD_RESET_ENABLED:'true',
  USBRIN_PASSWORD_PEPPER:'synthetic-qa-only-provider-reset-hash-pepper',
  ...options};
}
function context(env,path,payload){
 return {env,request:new Request(base+path,{method:'POST',headers:{
  origin:base,'content-type':'application/json','cf-connecting-ip':'198.51.100.3'},
  body:JSON.stringify(payload)})};
}
function approved(db){
 db.sqlite.prepare("INSERT INTO users(id,email,name,role,status) VALUES ('q1','qa-identity@usbrin.test','QA identity','representante','active')").run();
 db.sqlite.prepare("INSERT INTO zitadel_identity_links(zitadel_user_id,user_id,created_at) VALUES ('zq1','q1',1)").run();
}

test('only linked approved identities trigger provider reset email',async()=>{
 const db=new Database();approved(db);
 const env=environment(db);
 const original=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url:String(url),body:JSON.parse(options.body),redirect:options.redirect});
  return Response.json({details:{}});
 };
 try{
  const first=await requestReset(context(env,'/api/native/password/request',{email:'qa-identity@usbrin.test'}));
  assert.equal(first.status,202);
  assert.equal(calls.length,1);
  assert.equal(calls[0].redirect,'manual');
  assert.equal(calls[0].body.sendLink.notificationType,'NOTIFICATION_TYPE_Email');
  assert.ok(calls[0].body.sendLink.urlTemplate.includes('#userID={{.UserID}}&code={{.Code}}'));
  assert.equal(calls[0].body.returnCode,undefined);
  const unknown=await requestReset(context(env,'/api/native/password/request',{email:'missing@usbrin.test'}));
  assert.equal(unknown.status,202);
  assert.equal(calls.length,1);
  db.sqlite.prepare("UPDATE users SET status='suspended' WHERE id='q1'").run();
  const denied=await requestReset(context(env,'/api/native/password/request',{email:'qa-identity@usbrin.test'}));
  assert.equal(denied.status,202);
  assert.equal(calls.length,1);
 }finally{globalThis.fetch=original}
});
test('password recovery stays unavailable when provider email is not enabled',async()=>{
 const db=new Database();approved(db);
 const env=environment(db,{ZITADEL_PASSWORD_RESET_ENABLED:'false'});
 assert.equal((await requestReset(context(env,'/api/native/password/request',{email:'qa-identity@usbrin.test'}))).status,404);
 assert.equal((await confirmReset(context(env,'/api/native/password/confirm',{userID:'zq1',code:'code-for-test',password:'NewTestPassword2026!'}))).status,404);
});
