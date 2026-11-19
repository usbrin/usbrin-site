import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {onRequest as login} from "../functions/api/native/login.js";
import {onRequest as logout} from "../functions/api/native/logout.js";
import {onRequest as privateAPI} from "../functions/api/private/[[path]].js";
import {onRequest as middleware} from "../functions/_middleware.js";
import {onRequest as getUiConfig} from "../functions/api/native/config.js";

class D1 {
  constructor(){
    this.sql=new DatabaseSync(":memory:");
    for(const name of ["0001_partners.sql","0019_zitadel_identity_sessions.sql"])
      this.sql.exec(readFileSync(new URL("../migrations/"+name,import.meta.url),"utf8"));
  }
  prepare(sql){
    const db=this.sql;
    return {sql,values:[],
      bind(...v){this.values=v;return this;},
      async first(){return db.prepare(this.sql).get(...this.values)??null;},
      async all(){return {results:db.prepare(this.sql).all(...this.values)};},
      async run(){const r=db.prepare(this.sql).run(...this.values);return {meta:{changes:r.changes}};}
    };
  }
  async batch(statements){
    this.sql.exec("BEGIN");
    try{const result=[];for(const x of statements)result.push(await x.run());
      this.sql.exec("COMMIT");return result;}
    catch(e){this.sql.exec("ROLLBACK");throw e;}
  }
}
const host="https://usbrin-id-native-qa.pages.dev";
const origin="https://usbrin-id-rzf8mn.us1.zitadel.cloud";
const mail="parceiro@usbrin.test";
const password="Demo password 2026";
const pat="QA-ONLY-FAKE-LOGIN-CLIENT-PAT-DO-NOT-USE";
const userID="zitadel-qa-user-321";

function env(db,overrides={}){return {USBRIN_AUTH_MODE:"zitadel",USBRIN_ID_DB:db,
  NATIVE_AUTH_HOST:"usbrin-id-native-qa.pages.dev",ZITADEL_API_URL:origin,
  ZITADEL_LOGIN_CLIENT_TOKEN:pat,...overrides};}
function request(path,options={}){
  const {method="GET",body,origin:target=host,cookie,ip="198.51.100.11"}=options;
  return new Request(host+path,{method,headers:{origin:target,"cf-connecting-ip":ip,
    ...(body===undefined?{}:{"content-type":"application/json"}),
    ...(cookie?{cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const ctx=(e,path,opts)=>({env:e,request:request(path,opts)});
const loginReq=(e,details={})=>login(ctx(e,"/api/native/login",{
  method:"POST",body:{email:mail,password},...details
}));
function provision(db,{id="u1",role="representante",status="active",link=true}={}){
  db.sql.prepare("INSERT INTO users(id,email,name,role,status) VALUES (?,?,?,?,?)")
    .run(id,mail,"Usuário QA",role,status);
  if(link)db.sql.prepare(
    "INSERT INTO zitadel_identity_links(zitadel_user_id,user_id,created_at) VALUES (?,?,?)"
  ).run(userID,id,Math.floor(Date.now()/1000));
}
function fakeProvider({verified=true,remoteID=userID,totp=false,expires=true,missing=false}={}){
  const old=globalThis.fetch,history=[];
  let deleted=false;
  let totpVerified=false;
  globalThis.fetch=async(url,options)=>{
    assert.ok(String(url).startsWith(origin+"/v2/sessions"));
    assert.equal(options.headers.authorization,"Bearer "+pat);
    assert.equal(options.redirect,"manual","Provider credential must never follow redirects");
    history.push({url:String(url),method:options.method});
    const path=new URL(url).pathname;
    if(options.method==="POST"){
      deleted=false;
      totpVerified=false;
      return Response.json({sessionId:"999122200",sessionToken:"synthetic-token"});
    }
    if(options.method==="PATCH"){
      const request=JSON.parse(options.body);
      if(request.checks.totp){
        if(request.checks.totp.code!=="123456")return Response.json({},{status:400});
        totpVerified=true;
        return Response.json({sessionToken:"synthetic-mfa-token"});
      }
      if(request.checks.password?.password!==password)return Response.json({},{status:400});
      return Response.json({sessionToken:"synthetic-verified-token"});
    }
    if(options.method==="GET"){
      if(deleted||missing)return Response.json({},{status:404});
      const t=new Date().toISOString();
      const f={user:{id:remoteID,loginName:mail,verifiedAt:t},
        ...(verified?{password:{verifiedAt:t}}:{}),...(totp||totpVerified?{totp:{verifiedAt:t}}:{})};
      return Response.json({session:{id:"999122200",factors:f,
        expirationDate:new Date(Date.now()+(expires?3600000:-3000)).toISOString()}});
    }
    if(options.method==="DELETE"){deleted=true;return Response.json({details:{}});}
    throw Error("Unexpected method "+options.method);
  };
  return {history,restore:()=>{globalThis.fetch=old;},revoke:()=>{deleted=true;}};
}
function getCookie(r){
  return r.headers.getSetCookie().find(x=>x.startsWith("__Host-usbrin-zitadel="))?.split(";")[0];
}

test("ZITADEL login is disabled unless pinned host, session database and service token are present",async()=>{
  const db=new D1();
  const e=env(db);
  assert.equal((await loginReq(env(db,{USBRIN_AUTH_MODE:"native"}))).status,404);
  assert.equal((await loginReq(env(db,{ZITADEL_API_URL:"https://not-usbrin.zitadel.cloud"}))).status,404);
  assert.equal((await loginReq(env(db,{ZITADEL_LOGIN_CLIENT_TOKEN:undefined}))).status,404);
  assert.equal((await loginReq(env(db,{NATIVE_AUTH_HOST:"other.example.com"}))).status,404);
  assert.equal((await loginReq(e,{origin:"https://evil.example"})).status,403);
  assert.equal((await login(ctx(e,"/api/native/login",{method:"GET"}))).status,405);
});

test("approved and explicitly linked representative can log in using ZITADEL, authorize, then log out",async()=>{
  const db=new D1();provision(db);
  const provider=fakeProvider();
  try{
    const result=await loginReq(env(db));
    assert.equal(result.status,200);
    const cookie=getCookie(result);
    assert.match(cookie,/^__Host-usbrin-zitadel=[a-f0-9]{64}$/);
    assert.match(result.headers.get("set-cookie"),/Secure; HttpOnly; SameSite=Lax/);
    assert.ok(provider.history.some(x=>x.method==="POST"&&x.url.endsWith("/v2/sessions")));
    assert.ok(provider.history.some(x=>x.method==="PATCH"&&x.url.endsWith("/v2/sessions/999122200")));
    assert.ok(provider.history.some(x=>x.method==="GET"&&x.url.endsWith("/v2/sessions/999122200")));
    const me=await privateAPI(ctx(env(db),"/api/private/me",{cookie}));
    assert.equal(me.status,200);
    const info=await me.json();assert.equal(info.user.role,"representante");
    assert.equal(info.authMode,"zitadel");
    const privateDoc=await middleware({env:env(db),request:request("/portal",{cookie}),
      next:async()=>new Response("portal loaded")});
    assert.equal(privateDoc.status,200);
    const admin=await middleware({env:env(db),request:request("/proposta.html",{cookie}),
      next:async()=>new Response("admin loaded")});
    assert.equal(admin.status,404);
    const ended=await logout(ctx(env(db),"/api/native/logout",{method:"POST",cookie}));
    assert.equal(ended.status,200);
    assert.match(ended.headers.get("set-cookie"),/Max-Age=0/);
    assert.ok(provider.history.some(x=>x.method==="DELETE"));
    assert.equal((await privateAPI(ctx(env(db),"/api/private/me",{cookie}))).status,401);
  }finally{provider.restore();}
});

test("unlinked, suspended and invalid local identities never grant app cookies",async()=>{
  const db=new D1();provision(db,{link:false});
  const provider=fakeProvider();
  try{
    assert.equal((await loginReq(env(db))).status,401);
    assert.equal(provider.history.length,0);
    db.sql.prepare("INSERT INTO zitadel_identity_links(zitadel_user_id,user_id,created_at) VALUES (?,?,?)")
      .run(userID,"u1",Math.floor(Date.now()/1000));
    db.sql.prepare("UPDATE users SET status='suspended' WHERE id='u1'").run();
    assert.equal((await loginReq(env(db))).status,401);
    assert.equal(provider.history.length,0);
    db.sql.prepare("UPDATE users SET status='active' WHERE id='u1'").run();
    assert.equal((await loginReq(env(db),{body:{email:mail,password:"incorrect-password"}})).status,401);
    assert.ok(provider.history.some(x=>x.method==="DELETE"));
    assert.equal(db.sql.prepare("SELECT count(*) n FROM zitadel_app_sessions").get().n,0);
  }finally{provider.restore();}
});

test("fail closed on ZITADEL subject mismatch, missing password, expired external session",async()=>{
  for(const settings of [{remoteID:"different-identity"},{verified:false},{expires:false}]){
    const db=new D1();provision(db);
    const provider=fakeProvider(settings);
    try{
      const response=await loginReq(env(db));
      assert.equal(response.status,401);
      assert.equal(db.sql.prepare("SELECT count(*) n FROM zitadel_app_sessions").get().n,0);
      assert.ok(provider.history.some(x=>x.method==="DELETE"));
    }finally{provider.restore();}
  }
});

test("admin access requires verified second factor; password alone is rejected",async()=>{
  const db=new D1();provision(db,{role:"admin"});
  const provider=fakeProvider();
  try{
    const result=await loginReq(env(db));
    assert.equal(result.status,403);
    assert.equal((await result.json()).code,"mfa_required");
    assert.equal(db.sql.prepare("SELECT count(*) n FROM zitadel_app_sessions").get().n,0);
    assert.ok(provider.history.some(x=>x.method==="DELETE"));
  }finally{provider.restore();}
});

test("a remotely terminated ZITADEL session cannot regain access after next validation",async()=>{
  const db=new D1();provision(db);
  const provider=fakeProvider();
  const clock=Date.now;
  try{
    const loginResult=await loginReq(env(db));
    assert.equal(loginResult.status,200);
    const cookie=getCookie(loginResult);
    const t=Math.floor(clock()/1000);
    db.sql.prepare("UPDATE zitadel_app_sessions SET checked_at=?").run(t-301);
    provider.revoke();
    assert.equal((await privateAPI(ctx(env(db),"/api/private/me",{cookie}))).status,401);
  }finally{Date.now=clock;provider.restore();}
});

test("a suspended local user is denied despite a valid external password",async()=>{
  const db=new D1();provision(db);
  const provider=fakeProvider();
  try{
    const r=await loginReq(env(db));
    assert.equal(r.status,200);
    const cookie=getCookie(r);
    db.sql.prepare("UPDATE users SET status='suspended' WHERE id='u1'").run();
    assert.equal((await privateAPI(ctx(env(db),"/api/private/me",{cookie}))).status,403);
  }finally{provider.restore();}
});

test("UI hides native password recovery when ZITADEL handles credentials",async()=>{
  const db=new D1();
  const e=env(db);
  const r=getUiConfig(ctx(e,"/api/native/config"));
  assert.equal(r.status,200);
  const info=await r.json();
  assert.equal(info.mode,"zitadel");
  assert.equal(info.passwordRecovery,false);
  assert.equal(JSON.stringify(info).includes(pat),false);
  assert.equal((getUiConfig(ctx(env(db,{USBRIN_AUTH_MODE:"native",USBRIN_PASSWORD_EMAIL_ENABLED:"false"}),"/api/native/config"))).status,200);
  const denied=await getUiConfig(ctx(e,"/api/native/config",{method:"POST"}));
  assert.equal(denied.status,405);
});

test("provider redirect is rejected without following the service credential to other origins",async()=>{
  const db=new D1();provision(db);
  const oldFetch=globalThis.fetch;
  const seen=[];
  globalThis.fetch=async(_url,options)=>{
    seen.push(options.redirect);
    return new Response(null,{status:302,headers:{location:"https://malicious.example/steal"}});
  };
  try{
    const response=await loginReq(env(db));
    assert.equal(response.status,503);
    assert.deepEqual(seen,["manual"]);
    assert.equal(db.sql.prepare("SELECT count(*) n FROM zitadel_app_sessions").get().n,0);
  }finally{globalThis.fetch=oldFetch;}
});

test("administrator completes TOTP in USBRIN login after the password check",async()=>{
  const db=new D1();provision(db,{role:"admin"});
  const provider=fakeProvider();
  try{
    const first=await loginReq(env(db));
    assert.equal(first.status,403);
    assert.equal((await first.json()).code,"mfa_required");
    assert.equal(db.sql.prepare("SELECT count(*) n FROM zitadel_app_sessions").get().n,0);
    const wrong=await loginReq(env(db),{body:{email:mail,password,totp:"000000"}});
    assert.equal(wrong.status,401);
    assert.equal((await wrong.json()).code,"invalid_totp");
    assert.equal(db.sql.prepare("SELECT count(*) n FROM zitadel_app_sessions").get().n,0);
    const correct=await loginReq(env(db),{body:{email:mail,password,totp:"123456"}});
    assert.equal(correct.status,200);
    const cookie=getCookie(correct);
    assert.ok(cookie);
    const me=await privateAPI(ctx(env(db),"/api/private/me",{cookie}));
    assert.equal(me.status,200);
    assert.equal((await me.json()).user.role,"admin");
    const adminPage=await middleware({env:env(db),request:request("/proposta.html",{cookie}),
      next:async()=>new Response("admin only")});
    assert.equal(adminPage.status,200);
    assert.ok(provider.history.some(x=>x.method==="PATCH"&&x.url.endsWith("/v2/sessions/999122200")));
  }finally{provider.restore();}
});

test("nonadmins are never required to supply TOTP for normal password login",async()=>{
  const db=new D1();provision(db,{role:"desenvolvedor"});
  const provider=fakeProvider();
  try{
    const r=await loginReq(env(db));
    assert.equal(r.status,200);
    assert.ok(getCookie(r));
    assert.equal((await privateAPI(ctx(env(db),"/api/private/me",{cookie:getCookie(r)}))).status,200);
  }finally{provider.restore();}
});
