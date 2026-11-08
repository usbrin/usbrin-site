import {email} from "./security.js";

const roles=new Set(["admin","representante","desenvolvedor"]);
const algorithm={name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"};
const parse64=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),x=>x.charCodeAt(0));
const read=s=>JSON.parse(new TextDecoder().decode(parse64(s)));
const unavailable=()=>new AuthError("identity_unavailable","A verificação de acesso está temporariamente indisponível.",503);
const invalidSession=()=>new AuthError("session_required","Entre novamente com seu e-mail autorizado.",401);
let jwksCache=null;

export class AuthError extends Error{
  constructor(code,message,status){
    super(message);
    this.code=code;
    this.status=status;
  }
}

async function accessKeys(domain,kid){
  const now=Date.now();
  if(jwksCache?.domain===domain&&jwksCache.until>now){
    const key=jwksCache.keys.find(x=>x.kid===kid&&x.kty==="RSA");
    if(key||now-jwksCache.loadedAt<30000)return key;
  }
  try{
    const response=await fetch(domain+"/cdn-cgi/access/certs");
    if(!response.ok)throw unavailable();
    const {keys}=await response.json();
    if(!Array.isArray(keys)||!keys.length)throw unavailable();
    jwksCache={domain,keys,loadedAt:now,until:now+300000};
    return keys.find(x=>x.kid===kid&&x.kty==="RSA");
  }catch{
    throw unavailable();
  }
}

async function verifySession(request,env,domain){
  const token=request.headers.get("Cf-Access-Jwt-Assertion");
  if(!token||token.length>8192)throw invalidSession();
  const parts=token.split(".");
  if(parts.length!==3||!parts.every(s=>/^[A-Za-z0-9_-]+$/.test(s)))throw invalidSession();

  let header,claims;
  try{
    header=read(parts[0]);
    claims=read(parts[1]);
  }catch{
    throw invalidSession();
  }
  const now=Math.floor(Date.now()/1000);
  if(header?.alg!=="RS256"||typeof header.kid!=="string"||!header.kid||
     claims?.iss!==domain||claims.type!=="app"||!Array.isArray(claims.aud)||!claims.aud.includes(env.ACCESS_AUD)||
     !Number.isSafeInteger(claims.exp)||claims.exp<=now||
     !Number.isSafeInteger(claims.iat)||claims.iat>now+60||claims.iat>=claims.exp||
     !Number.isSafeInteger(claims.nbf)||claims.nbf>now+60||claims.nbf>=claims.exp||
     typeof claims.sub!=="string"||!claims.sub||typeof claims.email!=="string"||!email(claims.email)){
    throw invalidSession();
  }

  const jwk=await accessKeys(domain,header.kid);
  if(!jwk)throw invalidSession();
  try{
    const key=await crypto.subtle.importKey("jwk",jwk,algorithm,false,["verify"]);
    const valid=await crypto.subtle.verify(algorithm,key,parse64(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
    if(!valid)throw invalidSession();
  }catch{
    throw invalidSession();
  }
  return claims;
}

export async function authenticatedUser(request,env){
  const url=new URL(request.url),domain=String(env.ACCESS_TEAM_DOMAIN||"").replace(/\/$/,"");
  // The Access application must cover this exact host. Pages shares preview settings across branches.
  if(!env.DB||!env.ACCESS_AUD||url.protocol!=="https:"||url.host!==env.ACCESS_APP_HOST||
     !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(domain))throw unavailable();

  const claims=await verifySession(request,env,domain);
  let user;
  try{
    user=await env.DB.prepare("SELECT id,email,name,role,status FROM users WHERE email=?").bind(email(claims.email)).first();
  }catch{
    throw unavailable();
  }
  if(user?.status==="suspended")throw new AuthError("account_suspended","O acesso desta conta está suspenso. Fale com a USBRIN.",403);
  if(user?.status!=="active"||!roles.has(user.role)){
    throw new AuthError("account_not_approved","Esta conta ainda não tem acesso ao portal. Confira o e-mail usado ou acompanhe sua candidatura.",403);
  }
  // Set ACCESS_MFA_AUD only for an application with mandatory MFA on every matching Allow policy.
  if(user.role==="admin"&&(!env.ACCESS_MFA_AUD||env.ACCESS_MFA_AUD!==env.ACCESS_AUD)){
    throw new AuthError("mfa_required","O acesso administrativo depende da verificação em duas etapas. Fale com a USBRIN.",403);
  }
  return user;
}
