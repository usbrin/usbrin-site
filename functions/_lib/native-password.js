import {AuthError} from "./auth-errors.js";
import {email} from "./security.js";
import {hashPassword,newPasswordSalt,nativeReady} from "./native-auth.js";

// A verified mailbox is the only way to establish or recover a native password.
const TTL=20*60;
const WINDOW=60*60;
const ITERATIONS=600000;
const encoder=new TextEncoder();
const now=()=>Math.floor(Date.now()/1000);
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
const random=length=>hex(crypto.getRandomValues(new Uint8Array(length)));
const digest=async text=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(text))));
const validEmail=value=>typeof value==="string"&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const invalid=()=>new AuthError("invalid_password_link","Link inválido ou expirado. Solicite outro.",400);
const unavailable=()=>new AuthError("identity_unavailable","Recuperação de acesso temporariamente indisponível.",503);

function readyToSend(request,env){
  return nativeReady(request,env)&&env.USBRIN_PASSWORD_EMAIL_ENABLED==="true"&&
    typeof env.RESEND_API_KEY==="string"&&env.RESEND_API_KEY.length>=16&&
    typeof env.USBRIN_EMAIL_FROM==="string"&&env.USBRIN_EMAIL_FROM.length>5;
}

async function applyRequestLimits(db,ipKey,accountKey,t){
  const statement=`INSERT INTO native_password_request_limits(rate_key,attempts,window_start)
    VALUES (?,1,?)
    ON CONFLICT(rate_key) DO UPDATE SET
      attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END,
      window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END`;
  await db.batch([
    db.prepare(statement).bind(ipKey,t,t-WINDOW,t-WINDOW),
    db.prepare(statement).bind(accountKey,t,t-WINDOW,t-WINDOW)
  ]);
  const [ip,account]=await Promise.all([
    db.prepare("SELECT attempts FROM native_password_request_limits WHERE rate_key=?").bind(ipKey).first(),
    db.prepare("SELECT attempts FROM native_password_request_limits WHERE rate_key=?").bind(accountKey).first()
  ]);
  if(ip?.attempts>30||account?.attempts>3)
    throw new AuthError("rate_limited","Muitas solicitações. Tente novamente mais tarde.",429);
}

async function sendPasswordEmail(env,recipient,link){
  const payload={
    from:env.USBRIN_EMAIL_FROM,
    to:[recipient],
    subject:"USBRIN ID — Definir ou recuperar senha",
    text:"Você solicitou acesso à USBRIN ID. Use este link para definir sua senha (válido por 20 minutos):\n"+
      link+"\n\nSe você não fez essa solicitação, ignore a mensagem. Nenhuma senha foi alterada.",
  };
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{
      "authorization":"Bearer "+env.RESEND_API_KEY,
      "content-type":"application/json",
      "user-agent":"USBRIN-ID/1.0"
    },
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw new Error("Falha na entrega.");
  await response.body?.cancel();
}

export async function requestPasswordLink(request,env,mail){
  if(!readyToSend(request,env))throw unavailable();
  const db=env.USBRIN_ID_DB,t=now(),normalized=email(mail);
  const ip=(request.headers.get("cf-connecting-ip")||"unavailable").slice(0,80);
  const pepper=env.USBRIN_PASSWORD_PEPPER;
  await applyRequestLimits(db,
    await digest("password-request-ip\u0000"+ip+"\u0000"+pepper),
    await digest("password-request-account\u0000"+ip+"\u0000"+normalized+"\u0000"+pepper),t);
  if(!validEmail(normalized))return;
  const user=await db.prepare(
    "SELECT id,email FROM users WHERE email=? AND status='active' AND role IN ('admin','representante','desenvolvedor')"
  ).bind(normalized).first();
  if(!user)return;
  const token=random(32),key=await digest(token);
  await db.batch([
    db.prepare("DELETE FROM native_password_links WHERE expires_at<=?").bind(t),
    db.prepare("INSERT INTO native_password_links(token_digest,user_id,created_at,expires_at) VALUES (?,?,?,?)")
      .bind(key,user.id,t,t+TTL)
  ]);
  try{
    await sendPasswordEmail(env,user.email,new URL("/senha.html#token="+token,request.url).href);
  }catch{
    // Never report account-specific delivery outcomes to an anonymous requester.
    await db.prepare("DELETE FROM native_password_links WHERE token_digest=? AND consumed_at IS NULL").bind(key).run();
  }
}

export async function confirmPasswordLink(request,env,token,password){
  if(!nativeReady(request,env))throw unavailable();
  if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token)||
     typeof password!=="string"||password.length<12||password.length>128)
    throw invalid();
  const db=env.USBRIN_ID_DB,t=now(),tokenDigest=await digest(token);
  // Avoid doing an expensive password hash on invalid or expired tokens.
  const eligible=await db.prepare(
    `SELECT u.id FROM native_password_links p
     JOIN users u ON u.id=p.user_id
     WHERE p.token_digest=? AND p.consumed_at IS NULL AND p.expires_at>? AND u.status='active'`
  ).bind(tokenDigest,t).first();
  if(!eligible)throw invalid();
  const salt=newPasswordSalt(),passwordDigest=await hashPassword(password,salt,env.USBRIN_PASSWORD_PEPPER);
  const uniqueConsumption=random(16);
  const result=await db.batch([
    db.prepare(
      `UPDATE native_password_links SET consumed_at=?,consumed_nonce=?
       WHERE token_digest=? AND consumed_at IS NULL AND expires_at>?
       AND EXISTS (SELECT 1 FROM users u WHERE u.id=native_password_links.user_id AND u.status='active')`
    ).bind(t,uniqueConsumption,tokenDigest,t),
    db.prepare(
      `INSERT INTO native_credentials(user_id,salt_hex,hash_hex,iterations,version,created_at,updated_at)
       SELECT p.user_id,?,?,?,1,?,? FROM native_password_links p
       JOIN users u ON u.id=p.user_id
       WHERE p.token_digest=? AND p.consumed_nonce=? AND u.status='active'
       ON CONFLICT(user_id) DO UPDATE SET salt_hex=excluded.salt_hex,hash_hex=excluded.hash_hex,
         iterations=excluded.iterations,version=native_credentials.version+1,updated_at=excluded.updated_at`
    ).bind(salt,passwordDigest,ITERATIONS,t,t,tokenDigest,uniqueConsumption),
    db.prepare(
      `UPDATE native_sessions SET ended_at=?
       WHERE user_id IN (SELECT user_id FROM native_password_links
         WHERE token_digest=? AND consumed_nonce=?) AND ended_at IS NULL`
    ).bind(t,tokenDigest,uniqueConsumption),
    db.prepare(
      `DELETE FROM native_password_links WHERE user_id IN
        (SELECT user_id FROM native_password_links WHERE token_digest=? AND consumed_nonce=?)
        AND token_digest<>? AND consumed_at IS NULL`
    ).bind(tokenDigest,uniqueConsumption,tokenDigest)
  ]);
  if(result[0].meta?.changes!==1||result[1].meta?.changes!==1)throw invalid();
}
