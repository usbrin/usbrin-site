import {AuthError,authenticatedIdentity} from "./auth.js";
import {checkOrigin,error,respond} from "./security.js";

const SESSION="__Host-usbrin-session";
const CHALLENGE="__Host-usbrin-challenge";
const VERIFY="/api/session/verify";
const IDLE=30*60;
const CHALLENGE_TTL=5*60;
const nowSeconds=()=>Math.floor(Date.now()/1000);
export const portalSessionEnabled=env=>env.USBRIN_SESSION_EXPERIMENT==="true";
const needSession=()=>new AuthError("usbrin_session_required","Inicie uma nova sessão USBRIN com seu autenticador.",401);

function cookieValue(request,name){
  for(const item of (request.headers.get("cookie")||"").split(";")){
    const [key,value]=item.trim().split("=",2);
    if(key===name&&/^[0-9a-f]{64}$/.test(value||""))return value;
  }
  return "";
}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const secret=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async value=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
const cookie=(name,value,maxAge)=>name+"="+value+"; Path=/; Secure; HttpOnly; SameSite=Lax"+
  (maxAge===undefined?"":"; Max-Age="+maxAge);

function redirect(location,cookies=[]){
  const headers=new Headers({location,"cache-control":"no-store, private","referrer-policy":"no-referrer"});
  for(const value of cookies)headers.append("Set-Cookie",value);
  return new Response(null,{status:303,headers});
}

function transition(request,location,cookies){
  if(request.headers.get("accept")!=="application/json")return redirect(location,cookies);
  const response=respond({ok:true});
  for(const value of cookies)response.headers.append("Set-Cookie",value);
  return response;
}

const resetProof=host=>[
  "CF_Authorization=; Max-Age=0; Path="+VERIFY+"; Secure; HttpOnly; SameSite=Lax",
  "CF_Authorization=; Max-Age=0; Path="+VERIFY+"; Domain="+host+"; Secure; HttpOnly; SameSite=Lax"
];

export async function requirePortalSession(request,env,identity,touch){
  if(!portalSessionEnabled(env))return;
  const token=cookieValue(request,SESSION);
  if(!token)throw needSession();
  const key=await digest(token),now=nowSeconds();
  const args=[key,identity.user.id,identity.claims.sub,now-IDLE];
  const where="digest=? AND user_id=? AND access_sub=? AND ended_at IS NULL AND last_active_at>?";
  if(touch){
    const result=await env.USBRIN_ID_DB.prepare("UPDATE portal_sessions SET last_active_at=max(last_active_at,?) WHERE "+where)
      .bind(now,...args).run();
    if(result.meta?.changes===1)return;
  }else if(await env.USBRIN_ID_DB.prepare("SELECT 1 FROM portal_sessions WHERE "+where).bind(...args).first())return;
  throw needSession();
}

export async function handlePortalSession({request,env},action){
  const url=new URL(request.url);
  if(!portalSessionEnabled(env)||url.protocol!=="https:"||url.host!==env.ACCESS_APP_HOST)
    return error("Recurso indisponível.",404);
  if(request.method!==(action==="verify"?"GET":"POST"))return error("Método não permitido.",405);
  if(action!=="verify"&&!checkOrigin(request))return error("Origem não autorizada.",403);
  const db=env.USBRIN_ID_DB,now=nowSeconds();
  try{
    if(action==="logout"){
      const token=cookieValue(request,SESSION),challenge=cookieValue(request,CHALLENGE);
      const statements=[];
      if(token)statements.push(db.prepare("UPDATE portal_sessions SET ended_at=? WHERE digest=? AND ended_at IS NULL").bind(now,await digest(token)));
      if(challenge){
        const key=await digest(challenge);
        statements.push(db.prepare("DELETE FROM portal_session_challenges WHERE digest=?").bind(key),
          db.prepare("UPDATE portal_sessions SET ended_at=? WHERE challenge_digest=? AND ended_at IS NULL").bind(now,key));
      }
      if(statements.length)await db.batch(statements);
      return transition(request,"/public/usbrin-id",[cookie(SESSION,"",0),cookie(CHALLENGE,"",0),...resetProof(url.hostname)]);
    }
    const audience=env.USBRIN_ID_STEP_UP_AUD;
    if(!audience||audience===env.USBRIN_ID_ACCESS_AUD)return error("Verificação adicional indisponível.",503);
    if(action==="start"){
      const {user,claims}=await authenticatedIdentity(request,env);
      const challenge=secret();
      await db.batch([
        db.prepare("DELETE FROM portal_session_challenges WHERE expires_at<=?").bind(now),
        db.prepare("DELETE FROM portal_sessions WHERE last_active_at<=? AND proof_expires_at<=?").bind(now-IDLE,now),
        db.prepare("INSERT INTO portal_session_challenges VALUES (?,?,?,?,?)")
          .bind(await digest(challenge),user.id,claims.sub,now,now+CHALLENGE_TTL)
      ]);
      return transition(request,VERIFY,[cookie(CHALLENGE,challenge,CHALLENGE_TTL),...resetProof(url.hostname)]);
    }
    const challenge=cookieValue(request,CHALLENGE);
    if(!challenge)return redirect("/portal?confirmacao=pendente");
    const {user,claims}=await authenticatedIdentity(request,env,audience);
    const token=secret(),key=await digest(challenge);
    const [insert]=await db.batch([
      db.prepare(`INSERT INTO portal_sessions (digest,user_id,access_sub,challenge_digest,proof_digest,proof_expires_at,last_active_at)
        SELECT ?,user_id,access_sub,digest,?,?,? FROM portal_session_challenges
        WHERE digest=? AND user_id=? AND access_sub=? AND expires_at>? AND created_at<?
        ON CONFLICT(proof_digest) DO NOTHING`)
        .bind(await digest(token),await digest(request.headers.get("Cf-Access-Jwt-Assertion")),claims.exp,now,
          key,user.id,claims.sub,now,claims.iat),
      db.prepare("DELETE FROM portal_session_challenges WHERE digest=? AND user_id=? AND access_sub=?").bind(key,user.id,claims.sub)
    ]);
    const confirmed=insert.meta?.changes===1;
    return redirect(confirmed?"/portal":"/portal?confirmacao=pendente",[
      cookie(CHALLENGE,"",0),...resetProof(url.hostname),...(confirmed?[cookie(SESSION,token)]:[])
    ]);
  }catch(e){
    if(action==="verify"&&e instanceof AuthError&&e.code==="session_required")return redirect("/portal?confirmacao=pendente",resetProof(url.hostname));
    if(e instanceof AuthError)return respond({ok:false,error:e.message,code:e.code},e.status);
    return error("Não foi possível verificar a sessão. Tente novamente.",503);
  }
}
