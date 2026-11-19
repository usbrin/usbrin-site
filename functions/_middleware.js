import {nativeEnabled,nativeSessionIdentity,nativeReady} from "./_lib/native-auth.js";
import {AuthError} from "./_lib/auth-errors.js";

// Native-mode only: protect static portal pages and their scripts BEFORE Pages serves them.
// Legacy Cloudflare Access deployments retain their existing Access policy.
const protectedRoutes=new Map([
  ["/portal","portal"],
  ["/portal/","portal"],
  ["/portal.html","portal"],
  ["/js/portal.js","portal"],
  ["/proposta","admin"],
  ["/proposta/","admin"],
  ["/proposta.html","admin"],
  ["/js/proposta.js","admin"]
]);

const secureHeaders={
  "cache-control":"no-store, private",
  "x-content-type-options":"nosniff",
  "x-robots-tag":"noindex, nofollow",
  "referrer-policy":"no-referrer"
};

export async function onRequest(context){
  const {request,env}=context;
  if(!nativeEnabled(env))return context.next();
  const path=new URL(request.url).pathname;
  const required=protectedRoutes.get(path);
  if(!required)return context.next();

  if(request.method!=="GET"&&request.method!=="HEAD"){
    return new Response(null,{status:405,headers:secureHeaders});
  }
  if(!nativeReady(request,env)){
    return new Response("Acesso temporariamente indisponível.",{status:503,headers:secureHeaders});
  }
  let user;
  try{
    ({user}=await nativeSessionIdentity(request,env));
  }catch(err){
    if(err instanceof AuthError&&[401,403].includes(err.status)){
      if(path.startsWith("/js/"))return new Response("Não autorizado.",{status:401,headers:secureHeaders});
      return new Response(null,{status:302,headers:{...secureHeaders,location:"/login.html"}});
    }
    return new Response("Acesso temporariamente indisponível.",{status:503,headers:secureHeaders});
  }
  if(required==="admin"&&user.role!=="admin")
    return new Response("Recurso indisponível.",{status:404,headers:secureHeaders});
  const response=await context.next();
  const headers=new Headers(response.headers);
  for(const [name,value] of Object.entries(secureHeaders))headers.set(name,value);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
