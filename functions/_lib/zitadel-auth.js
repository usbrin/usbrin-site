import {AuthError} from "./auth-errors.js";
import {email} from "./security.js";

// All ZITADEL operations run on the server. No API credential or session token is sent to browser.
export const zitadelEnabled=env=>env.USBRIN_AUTH_MODE==="zitadel";
const ORIGIN="https://usbrin-id-rzf8mn.us1.zitadel.cloud";
const COOKIE="__Host-usbrin-zitadel";
const WINDOW_SECONDS=15*60;
const IDLE_SECONDS=30*60;
const ABSOLUTE_SECONDS=2*60*60;
const CHECK_SECONDS=5*60;
const roles=new Set(["admin","representante","desenvolvedor"]);
const encoder=new TextEncoder();
const now=()=>Math.floor(Date.now()/1000);
const hex=arr=>Array.from(arr,x=>x.toString(16).padStart(2,"0")).join("");
const random=length=>hex(crypto.getRandomValues(new Uint8Array(length)));
const sha=async value=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(value))));
const unavailable=()=>new AuthError("identity_unavailable","Não foi possível verificar a identidade. Tente novamente.",503);
const invalid=()=>new AuthError("invalid_credentials","E-mail ou senha incorretos.",401);
const denied=()=>new AuthError("native_session_required","Sua sessão terminou. Entre novamente na USBRIN ID.",401);
const validFactor=(value,t)=>Number.isFinite(Date.parse(value?.verifiedAt))&&
  Math.abs(Date.parse(value.verifiedAt)/1000-t)<180;
const requiresMfa=user=>user?.role==="admin";
const hasMfa=(factors,t)=>["totp","webAuthN","otpSms","otpEmail"].some(k=>validFactor(factors?.[k],t));
const isValidId=value=>typeof value==="string"&&value.length>=1&&value.length<=200&&/^[\w-]+$/.test(value);

export function zitadelReady(request,env){
  const url=new URL(request.url);
  return zitadelEnabled(env)&&url.protocol==="https:"&&
    url.hostname===env.NATIVE_AUTH_HOST&&url.port===""&&
    env.ZITADEL_API_URL===ORIGIN&&typeof env.ZITADEL_LOGIN_CLIENT_TOKEN==="string"&&
    env.ZITADEL_LOGIN_CLIENT_TOKEN.length>=32&&Boolean(env.USBRIN_ID_DB);
}

function cookie(token,seconds){
  return COOKIE+"="+token+"; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age="+seconds;
}
export const clearZitadelCookie=()=>cookie("",0);
function readToken(request){
  const item=(request.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="));
  const value=item?.slice(COOKIE.length+1)||"";
  return /^[a-f0-9]{64}$/.test(value)?value:"";
}

async function api(env,path,method,body){
  if(!/^\/v2\/sessions(?:\/[a-zA-Z0-9_-]+)?$/.test(path))throw unavailable();
  const response=await fetch(ORIGIN+path,{
    method,
    headers:{
      "authorization":"Bearer "+env.ZITADEL_LOGIN_CLIENT_TOKEN,
      "accept":"application/json",
      ...(body===undefined?{}:{"content-type":"application/json"})
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    redirect:"manual",
    cache:"no-store",
    signal:AbortSignal.timeout(8000)
  });
  // Workers does not implement redirect:"error". Reject all 3xx manually so
  // the service-account bearer token is never forwarded to another origin.
  if(response.status>=300&&response.status<400){
    await response.body?.cancel();
    throw unavailable();
  }
  let result=null;
  if(response.ok&&method!=="DELETE"){
    try{result=await response.json();}catch{throw unavailable();}
  }else await response.body?.cancel();
  return {status:response.status,ok:response.ok,result};
}

async function destroyExternal(env,id){
  if(!isValidId(id))return;
  try{await api(env,"/v2/sessions/"+encodeURIComponent(id),"DELETE",{});}catch{}
}
function inspectedSession(record,localUser,t,maxFactorAge=ABSOLUTE_SECONDS+180){
  const s=record?.session,f=s?.factors;
  const id=f?.user?.id;
  if(!s||!isValidId(s.id)||!isValidId(id)||
    !(Number.isFinite(Date.parse(f?.user?.verifiedAt))&&t-Date.parse(f.user.verifiedAt)/1000>=-180&&t-Date.parse(f.user.verifiedAt)/1000<maxFactorAge)||
    !(Number.isFinite(Date.parse(f?.password?.verifiedAt))&&t-Date.parse(f.password.verifiedAt)/1000>=-180&&t-Date.parse(f.password.verifiedAt)/1000<maxFactorAge)||
    !Number.isFinite(Date.parse(s.expirationDate))||Date.parse(s.expirationDate)/1000<=t||
    id!==localUser.zitadel_user_id)return false;
  if(requiresMfa(localUser)&&!["totp","webAuthN","otpSms","otpEmail"].some(k=>Number.isFinite(Date.parse(f?.[k]?.verifiedAt))&&t-Date.parse(f[k].verifiedAt)/1000>=-180&&t-Date.parse(f[k].verifiedAt)/1000<maxFactorAge))return false;
  return true;
}

async function throttle(env,request,mail,t){
  const ip=(request.headers.get("cf-connecting-ip")||"unspecified").slice(0,80);
  const secret=env.ZITADEL_LOGIN_CLIENT_TOKEN;
  const keys=[
    await sha("ip\u0000"+ip+"\u0000"+secret),
    await sha("pair\u0000"+ip+"\u0000"+mail+"\u0000"+secret)
  ];
  const rows=await Promise.all(keys.map(key=>env.USBRIN_ID_DB.prepare(
    "SELECT failures,window_start FROM zitadel_login_attempts WHERE rate_key=?"
  ).bind(key).first()));
  if(rows.some((row,i)=>row?.window_start>t-WINDOW_SECONDS&&row.failures>=(i===0?40:6)))
    throw new AuthError("rate_limited","Muitas tentativas. Tente novamente mais tarde.",429);
  return keys;
}
async function failed(env,keys,t){
  const statement=`INSERT INTO zitadel_login_attempts(rate_key,failures,window_start) VALUES (?,1,?)
    ON CONFLICT(rate_key) DO UPDATE SET failures=CASE WHEN window_start<? THEN 1 ELSE failures+1 END,
    window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END`;
  await env.USBRIN_ID_DB.batch(keys.map(key=>env.USBRIN_ID_DB.prepare(statement)
    .bind(key,t,t-WINDOW_SECONDS,t-WINDOW_SECONDS)));
}

export async function zitadelLogin(request,env,mail,password){
  if(!zitadelReady(request,env))throw unavailable();
  const db=env.USBRIN_ID_DB,t=now(),normalized=email(mail);
  const keys=await throttle(env,request,normalized,t);
  const validInput=typeof mail==="string"&&normalized.length<=254&&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)&&typeof password==="string"&&
    password.length>=1&&password.length<=512;
  if(!validInput){await failed(env,keys,t);throw invalid();}
  let user;
  try {
    user=await db.prepare(`SELECT u.id,u.email,u.name,u.role,u.status,l.zitadel_user_id
      FROM users u JOIN zitadel_identity_links l ON l.user_id=u.id WHERE u.email=?`
    ).bind(normalized).first();
  }catch{throw unavailable();}
  if(!user||user.status!=="active"||!roles.has(user.role)){
    await failed(env,keys,t);throw invalid();
  }

  let sid="";
  try{
    const create=await api(env,"/v2/sessions","POST",{
      checks:{user:{loginName:normalized}},lifetime:ABSOLUTE_SECONDS+"s"
    });
    if(create.status===401||create.status===403)throw unavailable();
    if(!create.ok||!isValidId(create.result?.sessionId)){await failed(env,keys,t);throw invalid();}
    sid=create.result.sessionId;
    const update=await api(env,"/v2/sessions/"+encodeURIComponent(sid),"PATCH",{
      checks:{password:{password}}
    });
    if(update.status===401)throw unavailable();
    if(!update.ok){await failed(env,keys,t);throw invalid();}
    const info=await api(env,"/v2/sessions/"+encodeURIComponent(sid),"GET");
    if(!info.ok)throw unavailable();
    if(!inspectedSession(info.result,user,now(),180)){
      await failed(env,keys,t);
      if(requiresMfa(user))throw new AuthError("mfa_required","Este perfil exige uma verificação adicional.",403);
      throw invalid();
    }
    const token=random(32);
    await db.batch([
      db.prepare("DELETE FROM zitadel_app_sessions WHERE expires_at<=?").bind(t),
      db.prepare("DELETE FROM zitadel_login_attempts WHERE rate_key=?").bind(keys[1]),
      db.prepare(`INSERT INTO zitadel_app_sessions
        (digest,user_id,zitadel_user_id,zitadel_session_id,created_at,last_active_at,expires_at,checked_at)
        VALUES (?,?,?,?,?,?,?,?)`
      ).bind(await sha(token),user.id,user.zitadel_user_id,sid,t,t,t+ABSOLUTE_SECONDS,t)
    ]);
    sid="";
    return {cookie:cookie(token,ABSOLUTE_SECONDS),user:{id:user.id,email:user.email,name:user.name,role:user.role}};
  }catch(error){
    if(error instanceof AuthError)throw error;
    throw unavailable();
  }finally {
    if(sid)await destroyExternal(env,sid);
  }
}

export async function zitadelSessionIdentity(request,env){
  if(!zitadelReady(request,env))throw unavailable();
  const token=readToken(request);
  if(!token)throw denied();
  const db=env.USBRIN_ID_DB,t=now(),digest=await sha(token);
  let s;
  try{
    s=await db.prepare(`SELECT u.id,u.name,u.email,u.role,u.status,
      z.zitadel_session_id,z.zitadel_user_id,z.checked_at
      FROM zitadel_app_sessions z
      JOIN users u ON z.user_id=u.id
      JOIN zitadel_identity_links l ON l.user_id=u.id AND l.zitadel_user_id=z.zitadel_user_id
      WHERE z.digest=? AND z.ended_at IS NULL AND z.expires_at>? AND z.last_active_at>?`
    ).bind(digest,t,t-IDLE_SECONDS).first();
  }catch{throw unavailable();}
  if(!s)throw denied();
  if(s.status==="suspended")throw new AuthError("account_suspended","Conta suspensa.",403);
  if(s.status!=="active"||!roles.has(s.role))throw denied();

  if(requiresMfa(s)||s.checked_at<=t-CHECK_SECONDS){
    let remote;
    try{
      remote=await api(env,"/v2/sessions/"+encodeURIComponent(s.zitadel_session_id),"GET");
    }catch{throw unavailable();}
    if(!remote.ok||!inspectedSession(remote.result,s,t))throw denied();
  }
  try{
    const touched=await db.prepare(`UPDATE zitadel_app_sessions
      SET last_active_at=?,checked_at=CASE WHEN checked_at<=? THEN ? ELSE checked_at END
      WHERE digest=? AND ended_at IS NULL AND expires_at>? AND last_active_at>?`
    ).bind(t,t-CHECK_SECONDS,t,digest,t,t-IDLE_SECONDS).run();
    if(touched.meta?.changes!==1)throw denied();
  }catch(error){
    if(error instanceof AuthError)throw error;
    throw unavailable();
  }
  return {user:{id:s.id,email:s.email,name:s.name,role:s.role},claims:{sub:"zitadel:"+s.zitadel_user_id}};
}

export async function zitadelLogout(request,env){
  if(!zitadelReady(request,env))throw unavailable();
  const token=readToken(request);
  if(!token)return clearZitadelCookie();
  const db=env.USBRIN_ID_DB,digest=await sha(token);
  const s=await db.prepare(
    "SELECT zitadel_session_id FROM zitadel_app_sessions WHERE digest=? AND ended_at IS NULL"
  ).bind(digest).first();
  await db.prepare(
    "UPDATE zitadel_app_sessions SET ended_at=? WHERE digest=? AND ended_at IS NULL"
  ).bind(now(),digest).run();
  if(s?.zitadel_session_id)await destroyExternal(env,s.zitadel_session_id);
  return clearZitadelCookie();
}
