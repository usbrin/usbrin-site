import {email} from "./security.js";
const parse64=(s)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),x=>x.charCodeAt(0));
const read=(s)=>JSON.parse(new TextDecoder().decode(parse64(s)));
let jwksCache=null;
export async function authenticatedUser(request,env){
  if(!env.DB||!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD)throw new Error("Portal ainda não configurado.");
  const domain=String(env.ACCESS_TEAM_DOMAIN).replace(/\/$/,"");
  if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(domain))throw Error("Domínio de identidade inválido.");
  const token=request.headers.get("Cf-Access-Jwt-Assertion");
  if(!token)throw new Error("Faça login para acessar o portal.");
  const chunks=token.split(".");
  if(chunks.length!==3)throw new Error("Sessão inválida.");
  const hdr=read(chunks[0]),data=read(chunks[1]),now=Math.floor(Date.now()/1000);
  if(hdr.alg!=="RS256"||!hdr.kid||data.iss!==domain||
     !(Array.isArray(data.aud)?data.aud:[data.aud]).includes(env.ACCESS_AUD)||
     !(data.exp>now)||data.nbf>now+60)throw new Error("Sessão inválida ou expirada.");
  if(!jwksCache||jwksCache.domain!==domain||jwksCache.until<Date.now()){
    const result=await fetch(domain+"/cdn-cgi/access/certs");
    if(!result.ok)throw Error("Falha na verificação de identidade.");
    const body=await result.json();jwksCache={domain,keys:body.keys||[],until:Date.now()+300000};
  }
  const jwk=jwksCache.keys.find(x=>x.kid===hdr.kid&&x.kty==="RSA");
  if(!jwk)throw Error("Assinatura desconhecida.");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,parse64(chunks[2]),new TextEncoder().encode(chunks[0]+"."+chunks[1]));
  if(!valid)throw Error("Assinatura inválida.");
  const mail=email(data.email);
  if(!mail)throw Error("Identidade sem e-mail.");
  const user=await env.DB.prepare("SELECT id,email,name,role,status FROM users WHERE email=?").bind(mail).first();
  if(!user||user.status!=="active")throw Error("Conta ainda não aprovada.");
  return user;
}
