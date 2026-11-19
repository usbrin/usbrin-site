import {AuthError} from "./auth-errors.js";
import {email} from "./security.js";
import {zitadelReady} from "./zitadel-auth.js";

// Email/password handling stays entirely with ZITADEL. This is opt-in until
// outbound email templates and permissions have been verified in isolated QA.
const ORIGIN="https://usbrin-id-rzf8mn.us1.zitadel.cloud";
const WINDOW=60*60;
const encoder=new TextEncoder();
const now=()=>Math.floor(Date.now()/1000);
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
const sha=async value=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(value))));
const invalid=()=>new AuthError("invalid_password_reset","Código inválido ou expirado. Solicite outro.",400);
const unavailable=()=>new AuthError("identity_unavailable","Recuperação de senha temporariamente indisponível.",503);
const knownId=id=>typeof id==="string"&&id.length>=1&&id.length<=200&&/^[a-zA-Z0-9_-]+$/.test(id);
const validEmail=mail=>mail.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);

export const zitadelPasswordReady=(request,env)=>
  zitadelReady(request,env)&&env.ZITADEL_PASSWORD_RESET_ENABLED==="true";

async function upstream(env,userID,kind,payload){
  if(!knownId(userID)||!["password_reset","password"].includes(kind))throw invalid();
  let result;
  try{
    const response=await fetch(ORIGIN+"/v2/users/"+encodeURIComponent(userID)+"/"+kind,{
      method:"POST",
      headers:{"authorization":"Bearer "+env.ZITADEL_LOGIN_CLIENT_TOKEN,
        "content-type":"application/json","accept":"application/json"},
      body:JSON.stringify(payload),
      redirect:"manual",
      signal:AbortSignal.timeout(10000)
    });
    // Never forward the service token to a redirect location.
    if(response.status>=300&&response.status<400){await response.body?.cancel();throw unavailable();}
    result=response.status;
    await response.body?.cancel();
  }catch(err){if(err instanceof AuthError)throw err;throw unavailable();}
  return result;
}

async function limit(request,env,identity,scope,maxIp,maxAccount){
  const db=env.USBRIN_ID_DB,t=now(),ip=(request.headers.get("cf-connecting-ip")||"unknown").slice(0,80);
  // Namespaced, opaque rate keys; never store an email or a bearer token.
  const keys=[
    await sha("zitadel-reset\0"+scope+"\0ip\0"+ip+"\0"+env.USBRIN_PASSWORD_PEPPER),
    await sha("zitadel-reset\0"+scope+"\0account\0"+identity+"\0"+env.USBRIN_PASSWORD_PEPPER)
  ];
  const sql=`INSERT INTO native_password_request_limits(rate_key,attempts,window_start)
    VALUES (?,1,?) ON CONFLICT(rate_key) DO UPDATE SET
    attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END,
    window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END`;
  await db.batch(keys.map(key=>db.prepare(sql).bind(key,t,t-WINDOW,t-WINDOW)));
  const rows=await Promise.all(keys.map(key=>db.prepare(
    "SELECT attempts FROM native_password_request_limits WHERE rate_key=?"
  ).bind(key).first()));
  if(rows[0]?.attempts>maxIp||rows[1]?.attempts>maxAccount)
    throw new AuthError("rate_limited","Muitas solicitações. Tente mais tarde.",429);
}

function ready(request,env){
  return zitadelPasswordReady(request,env)&&
    typeof env.USBRIN_PASSWORD_PEPPER==="string"&&env.USBRIN_PASSWORD_PEPPER.length>=32;
}

export async function requestZitadelPassword(request,env,mail){
  if(!ready(request,env))throw unavailable();
  const normalized=email(mail);
  await limit(request,env,normalized,"request",30,3);
  if(!validEmail(normalized))return;
  let user;
  try{
    user=await env.USBRIN_ID_DB.prepare(`SELECT l.zitadel_user_id
      FROM users u JOIN zitadel_identity_links l ON l.user_id=u.id
      WHERE u.email=? AND u.status='active' AND u.role IN ('admin','representante','desenvolvedor')`
    ).bind(normalized).first();
  }catch{throw unavailable();}
  if(!user||!knownId(user.zitadel_user_id))return;
  // The reset verification code is delivered only by ZITADEL to the registered
  // mailbox. Never call returnCode, email it ourselves, or log the response.
  const template=new URL("/senha.html",request.url).href+
    "#userID={{.UserID}}&code={{.Code}}";
  try{
    const status=await upstream(env,user.zitadel_user_id,"password_reset",{
      sendLink:{notificationType:"NOTIFICATION_TYPE_Email",urlTemplate:template}
    });
    if(status!==200)throw unavailable();
  }catch{
    // Don't reveal whether a linked and approved account exists or whether
    // the email provider failed for just this account.
    return;
  }
}

export async function confirmZitadelPassword(request,env,userID,code,password){
  if(!ready(request,env))throw unavailable();
  if(!knownId(userID)||typeof code!=="string"||code.length<4||code.length>256||
     typeof password!=="string"||password.length<12||password.length>128)throw invalid();
  await limit(request,env,userID,"confirm",30,6);
  let user;
  try{
    user=await env.USBRIN_ID_DB.prepare(`SELECT u.id
      FROM users u JOIN zitadel_identity_links l ON l.user_id=u.id
      WHERE l.zitadel_user_id=? AND u.status='active'`
    ).bind(userID).first();
  }catch{throw unavailable();}
  if(!user)throw invalid();
  const status=await upstream(env,userID,"password",{
    newPassword:{password,changeRequired:false},
    verificationCode:code
  });
  if(status===400||status===404||status===422)throw invalid();
  if(status!==200)throw unavailable();
  try {
    // All USBRIN application sessions are revoked upon any password change.
    await env.USBRIN_ID_DB.prepare(
      "UPDATE zitadel_app_sessions SET ended_at=? WHERE user_id=? AND ended_at IS NULL"
    ).bind(now(),user.id).run();
  }catch{
    // Password was changed; if local sessions cannot be revoked, never claim
    // successful completion until the database is healthy.
    throw unavailable();
  }
}
