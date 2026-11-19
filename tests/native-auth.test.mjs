import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {newPasswordSalt,hashPassword} from "../functions/_lib/native-auth.js";
import {onRequest as login} from "../functions/api/native/login.js";
import {onRequest as logout} from "../functions/api/native/logout.js";
import {onRequest as requestPassword} from "../functions/api/native/password/request.js";
import {onRequest as confirmPassword} from "../functions/api/native/password/confirm.js";
import {onRequest as privateAPI} from "../functions/api/private/[[path]].js";

class D1 {
  constructor(){
    this.sqlite=new DatabaseSync(":memory:");
    for(const file of ["0001_partners.sql","0017_native_credentials.sql","0018_native_password_links.sql"]){
      this.sqlite.exec(readFileSync(new URL("../migrations/"+file,import.meta.url),"utf8"));
    }
  }
  prepare(sql){
    const db=this.sqlite;
    return {sql,values:[],
      bind(...values){this.values=values;return this;},
      async first(){return db.prepare(this.sql).get(...this.values)??null;},
      async all(){return {results:db.prepare(this.sql).all(...this.values)};},
      async run(){const change=db.prepare(this.sql).run(...this.values);return {meta:{changes:change.changes}};}
    };
  }
  async batch(statements){
    this.sqlite.exec("BEGIN");
    try {
      const results=[];
      for(const stmt of statements)results.push(await stmt.run());
      this.sqlite.exec("COMMIT");
      return results;
    }catch(error){this.sqlite.exec("ROLLBACK");throw error;}
  }
}
const base="https://usbrin-native-qa.pages.dev";
const pepper="unit-test-only-not-an-application-secret-very-long-string";
const password="correct horse battery! 2026";
const email="representante@usbrin.test";

function req(path,{method="GET",origin=base,cookie="",body,ip="203.0.113.55"}={}){
  return new Request(base+path,{method,
    headers:{"origin":origin,"cf-connecting-ip":ip,...(cookie?{cookie}:{}),
      ...(body===undefined?{}:{"content-type":"application/json"})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
}
function context(env,path,options){return {env,request:req(path,options)};}
const getCookie=response=>response.headers.getSetCookie()
  .find(x=>x.startsWith("__Host-usbrin-native="))?.split(";")[0];

test("native login is opt-in, only via HTTPS host and same-origin POST",async()=>{
  const db=new D1();
  const env={USBRIN_ID_DB:db,NATIVE_AUTH_HOST:"usbrin-native-qa.pages.dev",USBRIN_PASSWORD_PEPPER:pepper};
  const payload={email,password};
  assert.equal((await login(context(env,"/api/native/login",{method:"POST",body:payload}))).status,404);
  env.USBRIN_AUTH_MODE="native";
  assert.equal((await login(context(env,"/api/native/login",{method:"GET"}))).status,405);
  assert.equal((await login(context(env,"/api/native/login",{method:"POST",body:payload,origin:"https://other.example"}))).status,403);
  assert.equal((await login(context({...env,USBRIN_PASSWORD_PEPPER:undefined},"/api/native/login",{method:"POST",body:payload}))).status,404);
  assert.equal((await privateAPI(context({...env,USBRIN_AUTH_MODE:"access"},"/api/private/me"))).status,503);
});

test("approved representative logs in, has isolated role and can revoke session",async()=>{
  const db=new D1();
  const t=Math.floor(Date.now()/1000);
  const salt=newPasswordSalt(),hash=await hashPassword(password,salt,pepper);
  db.sqlite.prepare("INSERT INTO users(id,email,name,role,status) VALUES (?,?,?,'representante','active')")
    .run("r1",email,"Representante de Teste");
  db.sqlite.prepare("INSERT INTO native_credentials(user_id,salt_hex,hash_hex,iterations,version,created_at,updated_at) VALUES (?,?,?,600000,1,?,?)")
    .run("r1",salt,hash,t,t);
  const env={USBRIN_ID_DB:db,USBRIN_AUTH_MODE:"native",
    NATIVE_AUTH_HOST:"usbrin-native-qa.pages.dev",USBRIN_PASSWORD_PEPPER:pepper};

  const wrong=await login(context(env,"/api/native/login",
    {method:"POST",body:{email,password:"wrong password 123"}}));
  assert.equal(wrong.status,401);
  assert.equal((await wrong.json()).code,"invalid_credentials");
  const response=await login(context(env,"/api/native/login",{method:"POST",body:{email,password}}));
  assert.equal(response.status,200);
  const cookie=getCookie(response);
  assert.match(cookie,/^__Host-usbrin-native=[a-f0-9]{64}$/);
  assert.match(response.headers.getSetCookie()[0],/Secure; HttpOnly; SameSite=Lax; Max-Age=/);
  const who=await privateAPI(context(env,"/api/private/me",{cookie}));
  assert.equal(who.status,200);
  const user=await who.json();
  assert.equal(user.authMode,"native");
  assert.equal(user.user.role,"representante");
  assert.equal(user.workSession,false);
  assert.equal((await privateAPI(context(env,"/api/private/admin/overview",{cookie}))).status,404);

  const badLogout=await logout(context(env,"/api/native/logout",{method:"POST",cookie,origin:"https://foreign.test"}));
  assert.equal(badLogout.status,403);
  assert.equal((await privateAPI(context(env,"/api/private/me",{cookie}))).status,200);
  const done=await logout(context(env,"/api/native/logout",{method:"POST",cookie}));
  assert.equal(done.status,200);
  assert.match(done.headers.get("set-cookie"),/Max-Age=0/);
  const revoked=await privateAPI(context(env,"/api/private/me",{cookie}));
  assert.equal(revoked.status,401);
  assert.equal((await revoked.json()).code,"native_session_required");

  // A locked account cannot reauthenticate even when a password record exists.
  db.sqlite.prepare("UPDATE users SET status='suspended' WHERE id='r1'").run();
  const suspended=await login(context(env,"/api/native/login",{method:"POST",body:{email,password}}));
  assert.equal(suspended.status,401);
});

test("bad password attempts are rate-limited without exposing account existence",async()=>{
  const db=new D1(),env={USBRIN_ID_DB:db,USBRIN_AUTH_MODE:"native",
    NATIVE_AUTH_HOST:"usbrin-native-qa.pages.dev",USBRIN_PASSWORD_PEPPER:pepper};
  for(let n=0;n<6;n++){
    const r=await login(context(env,"/api/native/login",{method:"POST",body:{email:"unknown@usbrin.test",password}}));
    assert.equal(r.status,401);
    assert.equal((await r.json()).code,"invalid_credentials");
  }
  const locked=await login(context(env,"/api/native/login",{method:"POST",body:{email:"unknown@usbrin.test",password}}));
  assert.equal(locked.status,429);
});


test("native sessions expire after inactivity and password changes invalidate cookies",async()=>{
  const db=new D1(),clock=Date.now;
  let t=Math.floor(clock()/1000);
  Date.now=()=>t*1000;
  try{
    const salt=newPasswordSalt(),hash=await hashPassword(password,salt,pepper);
    db.sqlite.prepare("INSERT INTO users(id,email,name,role,status) VALUES (?,?,?,'representante','active')")
      .run("r2",email,"Representante de Teste");
    db.sqlite.prepare("INSERT INTO native_credentials(user_id,salt_hex,hash_hex,iterations,version,created_at,updated_at) VALUES (?,?,?,600000,1,?,?)")
      .run("r2",salt,hash,t,t);
    const env={USBRIN_ID_DB:db,USBRIN_AUTH_MODE:"native",
      NATIVE_AUTH_HOST:"usbrin-native-qa.pages.dev",USBRIN_PASSWORD_PEPPER:pepper};
    let result=await login(context(env,"/api/native/login",{method:"POST",body:{email,password}}));
    assert.equal(result.status,200);
    const cookie=getCookie(result);
    t+=30*60+1;
    assert.equal((await privateAPI(context(env,"/api/private/me",{cookie}))).status,401);
    result=await login(context(env,"/api/native/login",{method:"POST",body:{email,password}}));
    assert.equal(result.status,200);
    const freshCookie=getCookie(result);
    assert.equal((await privateAPI(context(env,"/api/private/me",{cookie:freshCookie}))).status,200);
    db.sqlite.prepare("UPDATE native_credentials SET version=version+1 WHERE user_id='r2'").run();
    assert.equal((await privateAPI(context(env,"/api/private/me",{cookie:freshCookie}))).status,401);
  }finally{Date.now=clock;}
});

test("approved accounts establish a password only through a single-use emailed link",async()=>{
  const db=new D1(),t=Math.floor(Date.now()/1000);
  const env={USBRIN_ID_DB:db,USBRIN_AUTH_MODE:"native",NATIVE_AUTH_HOST:"usbrin-native-qa.pages.dev",
    USBRIN_PASSWORD_PEPPER:pepper,USBRIN_PASSWORD_EMAIL_ENABLED:"true",
    RESEND_API_KEY:"qa-only-synthetic-provider-token",
    USBRIN_EMAIL_FROM:"USBRIN <acesso@usbrin.com.br>"};
  db.sqlite.prepare("INSERT INTO users(id,email,name,role,status) VALUES (?,?,?,'representante','active')")
    .run("r3",email,"Representante Aprovado");
  const originalFetch=globalThis.fetch;
  let mailed=[];
  globalThis.fetch=async(uri,options)=>{
    assert.equal(String(uri),"https://api.resend.com/emails");
    mailed.push(JSON.parse(options.body));
    return new Response(null,{status:202});
  };
  try{
    const initialLogin=await login(context(env,"/api/native/login",{method:"POST",body:{email,password}}));
    assert.equal(initialLogin.status,401);
    const invalidOrigin=await requestPassword(context(env,"/api/native/password/request",{
      method:"POST",origin:"https://outside.example",body:{email}
    }));
    assert.equal(invalidOrigin.status,403);
    const requestResult=await requestPassword(context(env,"/api/native/password/request",{
      method:"POST",body:{email}
    }));
    assert.equal(requestResult.status,202);
    assert.equal(mailed.length,1);
    assert.equal(mailed[0].to[0],email);
    const link=mailed[0].text.match(/https:\/\/[^\s]+\/senha\.html#token=([a-f0-9]{64})/);
    assert.ok(link);
    const token=link[1];
    const stored=db.sqlite.prepare("SELECT token_digest FROM native_password_links").get();
    assert.notEqual(stored.token_digest,token);

    const incorrect=await confirmPassword(context(env,"/api/native/password/confirm",{
      method:"POST",body:{token:"00".repeat(32),password}
    }));
    assert.equal(incorrect.status,400);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) total FROM native_credentials").get().total,0);

    const submitted=await confirmPassword(context(env,"/api/native/password/confirm",{
      method:"POST",body:{token,password}
    }));
    assert.equal(submitted.status,200);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) total FROM native_credentials").get().total,1);
    const used=await confirmPassword(context(env,"/api/native/password/confirm",{
      method:"POST",body:{token,password:"another long password 456"}
    }));
    assert.equal(used.status,400);
    const signedIn=await login(context(env,"/api/native/login",{method:"POST",body:{email,password}}));
    assert.equal(signedIn.status,200);
    const originalCookie=getCookie(signedIn);

    const newRequest=await requestPassword(context(env,"/api/native/password/request",{
      method:"POST",body:{email}
    }));
    assert.equal(newRequest.status,202);
    const newToken=mailed[1].text.match(/#token=([a-f0-9]{64})/)[1];
    assert.notEqual(newToken,token);
    const changed=await confirmPassword(context(env,"/api/native/password/confirm",{
      method:"POST",body:{token:newToken,password:"another long password 456"}
    }));
    assert.equal(changed.status,200);
    assert.equal((await privateAPI(context(env,"/api/private/me",{cookie:originalCookie}))).status,401);
    assert.equal((await login(context(env,"/api/native/login",{method:"POST",body:{email,password}}))).status,401);
    assert.equal((await login(context(env,"/api/native/login",{
      method:"POST",body:{email,password:"another long password 456"}
    }))).status,200);

    const unknown=await requestPassword(context(env,"/api/native/password/request",{
      method:"POST",body:{email:"unknown@usbrin.test"}
    }));
    assert.equal(unknown.status,202);
    assert.equal(mailed.length,2,"unknown accounts must not generate emails");
  }finally{globalThis.fetch=originalFetch}
});

test("expired links and suspended accounts cannot reset a password",async()=>{
  const db=new D1(),clock=Date.now;
  let t=Math.floor(clock()/1000);
  Date.now=()=>t*1000;
  const env={USBRIN_ID_DB:db,USBRIN_AUTH_MODE:"native",NATIVE_AUTH_HOST:"usbrin-native-qa.pages.dev",
    USBRIN_PASSWORD_PEPPER:pepper,USBRIN_PASSWORD_EMAIL_ENABLED:"true",
    RESEND_API_KEY:"qa-only-synthetic-provider-token",
    USBRIN_EMAIL_FROM:"USBRIN <acesso@usbrin.com.br>"};
  db.sqlite.prepare("INSERT INTO users(id,email,name,role,status) VALUES (?,?,?,'representante','active')")
    .run("r4",email,"Representante Aprovado");
  const originalFetch=globalThis.fetch;
  let link;
  globalThis.fetch=async(_uri,options)=>{
    link=JSON.parse(options.body).text.match(/#token=([a-f0-9]{64})/)[1];
    return new Response(null,{status:202});
  };
  try{
    await requestPassword(context(env,"/api/native/password/request",{method:"POST",body:{email}}));
    t+=20*60+1;
    assert.equal((await confirmPassword(context(env,"/api/native/password/confirm",{
      method:"POST",body:{token:link,password}
    }))).status,400);

    await requestPassword(context(env,"/api/native/password/request",{method:"POST",body:{email}}));
    db.sqlite.prepare("UPDATE users SET status='suspended' WHERE id='r4'").run();
    assert.equal((await confirmPassword(context(env,"/api/native/password/confirm",{
      method:"POST",body:{token:link,password}
    }))).status,400);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) total FROM native_credentials").get().total,0);
  }finally{Date.now=clock;globalThis.fetch=originalFetch}
});

test("password request limits and mail configuration fail closed",async()=>{
  const db=new D1(),env={USBRIN_ID_DB:db,USBRIN_AUTH_MODE:"native",
    NATIVE_AUTH_HOST:"usbrin-native-qa.pages.dev",USBRIN_PASSWORD_PEPPER:pepper,
    USBRIN_PASSWORD_EMAIL_ENABLED:"true",RESEND_API_KEY:"qa-only-synthetic-provider-token",
    USBRIN_EMAIL_FROM:"USBRIN <acesso@usbrin.com.br>"};
  assert.equal((await requestPassword(context({...env,RESEND_API_KEY:undefined},
    "/api/native/password/request",{method:"POST",body:{email}}))).status,503);
  for(let i=0;i<3;i++){
    const response=await requestPassword(context(env,"/api/native/password/request",{method:"POST",body:{email}}));
    assert.equal(response.status,202);
  }
  assert.equal((await requestPassword(context(env,"/api/native/password/request",{
    method:"POST",body:{email}
  }))).status,429);
});
