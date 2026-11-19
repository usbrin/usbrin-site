import {AuthError} from "./auth-errors.js";
import {email} from "./security.js";

// Native login is strictly opt-in; no fallback from Cloudflare Access on a failed login.
export const nativeEnabled=env=>env.USBRIN_AUTH_MODE==="native";
const COOKIE="__Host-usbrin-native";
const IDLE_SECONDS=30*60;
const ABSOLUTE_SECONDS=12*60*60;
const WINDOW_SECONDS=15*60;
const ITERATIONS=600000;
const roles=new Set(["admin","representante","desenvolvedor"]);
const encoder=new TextEncoder();
const now=()=>Math.floor(Date.now()/1000);
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
const random=length=>hex(crypto.getRandomValues(new Uint8Array(length)));
const bytes=hexValue=>new Uint8Array(hexValue.match(/.{2}/g).map(x=>parseInt(x,16)));
const sha=async string=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(string))));
const denied=()=>new AuthError("native_session_required","Sua sessão terminou. Entre novamente na USBRIN ID.",401);
const unavailable=()=>new AuthError("identity_unavailable","Login USBRIN ID temporariamente indisponível.",503);
const isValidHash=value=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value);
const constantTimeEqual=(a,b)=>{
  const aBytes=bytes(a),bBytes=bytes(b);
  let mismatch=aBytes.length^bBytes.length;
  for(let i=0;i<Math.min(aBytes.length,bBytes.length);i++)mismatch|=aBytes[i]^bBytes[i];
  return mismatch===0;
};

export function nativeReady(request,env){
  const url=new URL(request.url);
  return nativeEnabled(env)&&url.protocol==="https:"&&url.host===env.NATIVE_AUTH_HOST&&
    Boolean(env.USBRIN_ID_DB)&&typeof env.USBRIN_PASSWORD_PEPPER==="string"&&
    env.USBRIN_PASSWORD_PEPPER.length>=32;
}

export function nativeCookie(request){
  const found=(request.headers.get("cookie")||"").split(";").map(x=>x.trim())
    .find(x=>x.startsWith(COOKIE+"="));
  const token=found?.slice(COOKIE.length+1)||"";
  return /^[a-f0-9]{64}$/.test(token)?token:"";
}
const sessionCookie=(token,maxAge)=>COOKIE+"="+token+
  "; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age="+maxAge;
export const clearNativeCookie=()=>sessionCookie("",0);

export async function hashPassword(password,saltHex,pepper,iterations=ITERATIONS){
  if(typeof password!=="string"||password.length<12||password.length>128||
    !/^[a-f0-9]{32}$/.test(saltHex)||typeof pepper!=="string"||pepper.length<32||
    !Number.isSafeInteger(iterations)||iterations<ITERATIONS||iterations>1200000)throw Error("Credencial inválida.");
  const key=await crypto.subtle.importKey("raw",encoder.encode(password+"\u0000"+pepper),
    "PBKDF2",false,["deriveBits"]);
  const result=await crypto.subtle.deriveBits({
    name:"PBKDF2",hash:"SHA-256",salt:bytes(saltHex),iterations
  },key,256);
  return hex(new Uint8Array(result));
}
export const newPasswordSalt=()=>random(16);

async function rateInfo(db,key){
  return db.prepare("SELECT failures,window_start FROM native_login_attempts WHERE rate_key=?")
    .bind(key).first();
}
async function addFailure(db,keys,t){
  await db.batch(keys.map(key=>db.prepare(
    `INSERT INTO native_login_attempts(rate_key,failures,window_start) VALUES (?,1,?)
     ON CONFLICT(rate_key) DO UPDATE SET
       failures=CASE WHEN window_start<? THEN 1 ELSE failures+1 END,
       window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END`
  ).bind(key,t,t-WINDOW_SECONDS,t-WINDOW_SECONDS)));
}

export async function nativeLogin(request,env,mail,password){
  if(!nativeReady(request,env))throw unavailable();
  const db=env.USBRIN_ID_DB;
  const normalized=email(mail),t=now();
  const ip=(request.headers.get("cf-connecting-ip")||"unavailable").slice(0,80);
  const salt=env.USBRIN_PASSWORD_PEPPER;
  const ipKey=await sha("ip\u0000"+ip+"\u0000"+salt);
  const pairKey=await sha("pair\u0000"+ip+"\u0000"+normalized+"\u0000"+salt);
  const [ipCount,pairCount]=await Promise.all([rateInfo(db,ipKey),rateInfo(db,pairKey)]);
  const active=(row,limit)=>row&&row.window_start>t-WINDOW_SECONDS&&row.failures>=limit;
  if(active(ipCount,40)||active(pairCount,6))
    throw new AuthError("rate_limited","Muitas tentativas. Tente novamente mais tarde.",429);

  let credential=null;
  if(typeof normalized==="string"&&normalized.length<=254&&normalized.includes("@")){
    credential=await db.prepare(
      "SELECT u.id,u.email,u.name,u.role,u.status,c.salt_hex,c.hash_hex,c.iterations,c.version FROM users u JOIN native_credentials c ON c.user_id=u.id WHERE u.email=?"
    ).bind(normalized).first();
  }
  // Run the same expensive derivation for unknown accounts to reduce enumeration signals.
  const actualSalt=/^[a-f0-9]{32}$/.test(credential?.salt_hex||"")?credential.salt_hex:"00000000000000000000000000000000";
  const actualIterations=Number.isSafeInteger(credential?.iterations)&&
    credential.iterations>=ITERATIONS&&credential.iterations<=1200000?credential.iterations:ITERATIONS;
  const wellFormed=typeof password==="string"&&password.length>=12&&password.length<=128;
  const candidate=await hashPassword(wellFormed?password:"invalid-password-placeholder",
    actualSalt,salt,actualIterations);
  const valid=Boolean(wellFormed&&credential?.status==="active"&&roles.has(credential.role)&&
    isValidHash(credential.hash_hex)&&constantTimeEqual(candidate,credential.hash_hex));
  if(!valid){
    await addFailure(db,[ipKey,pairKey],t);
    throw new AuthError("invalid_credentials","E-mail ou senha incorretos.",401);
  }
  const token=random(32);
  await db.batch([
    db.prepare("DELETE FROM native_sessions WHERE expires_at<=?").bind(t),
    db.prepare("DELETE FROM native_login_attempts WHERE rate_key=?").bind(pairKey),
    db.prepare("INSERT INTO native_sessions(digest,user_id,credentials_version,created_at,last_active_at,expires_at) VALUES (?,?,?,?,?,?)")
      .bind(await sha(token),credential.id,credential.version,t,t,t+ABSOLUTE_SECONDS)
  ]);
  return {
    cookie:sessionCookie(token,ABSOLUTE_SECONDS),
    user:{id:credential.id,email:credential.email,name:credential.name,role:credential.role}
  };
}

export async function nativeSessionIdentity(request,env){
  if(!nativeReady(request,env))throw unavailable();
  const token=nativeCookie(request);
  if(!token)throw denied();
  const db=env.USBRIN_ID_DB,t=now(),digest=await sha(token);
  let entry;
  try{
    entry=await db.prepare(
      `SELECT u.id,u.email,u.name,u.role,u.status FROM native_sessions s
       JOIN users u ON u.id=s.user_id
       JOIN native_credentials c ON c.user_id=u.id
       WHERE s.digest=? AND s.ended_at IS NULL AND s.expires_at>?
       AND s.last_active_at>? AND s.credentials_version=c.version`
    ).bind(digest,t,t-IDLE_SECONDS).first();
    if(!entry)throw denied();
    if(entry.status==="suspended")throw new AuthError("account_suspended","Conta suspensa.",403);
    if(entry.status!=="active"||!roles.has(entry.role))throw denied();
    const touch=await db.prepare(
      "UPDATE native_sessions SET last_active_at=? WHERE digest=? AND ended_at IS NULL AND expires_at>? AND last_active_at>?"
    ).bind(t,digest,t,t-IDLE_SECONDS).run();
    if(touch.meta?.changes!==1)throw denied();
  }catch(error){
    if(error instanceof AuthError)throw error;
    throw unavailable();
  }
  return {user:{id:entry.id,email:entry.email,name:entry.name,role:entry.role},claims:{sub:"native:"+entry.id}};
}

export async function nativeLogout(request,env){
  if(!nativeReady(request,env))throw unavailable();
  const token=nativeCookie(request);
  if(token){
    await env.USBRIN_ID_DB.prepare("UPDATE native_sessions SET ended_at=? WHERE digest=? AND ended_at IS NULL")
      .bind(now(),await sha(token)).run();
  }
  return clearNativeCookie();
}
