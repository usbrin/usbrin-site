// USBRIN Partners — shared API safeguards. Never store credentials in client-side code.
export const respond=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store, private","x-content-type-options":"nosniff"}
});
export const error=(message,status=400)=>respond({ok:false,error:message},status);
export const email=value=>String(value||"").trim().toLowerCase();
export const str=(value,max=255)=>typeof value==="string"?value.trim().slice(0,max):"";
export async function readBody(request,max=12000){
 const contentType=request.headers.get("content-type")||"";
 if(!/^application\/json(?:\s*;|\s*$)/i.test(contentType))throw new SyntaxError("O conteúdo deve ser JSON.");
 const declaredSize=Number(request.headers.get("content-length")||0);
 if(declaredSize>max)throw new SyntaxError("Dados muito extensos.");
 const raw=await request.text();
 if(raw.length>max)throw new SyntaxError("Dados muito extensos.");
 let data;try{data=JSON.parse(raw);}catch{throw new SyntaxError("JSON inválido.");}
 if(!data||Array.isArray(data)||typeof data!=="object")throw new SyntaxError("Objeto JSON obrigatório.");
 return data;
}
export function checkOrigin(request){
 const origin=request.headers.get("origin");
 return Boolean(origin && origin===new URL(request.url).origin);
}
export async function verifiedTurnstile(token,env,request){
 if(!env.TURNSTILE_SECRET||typeof token!=="string"||token.length<10||token.length>2048)return false;
 const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
   method:"POST",
   headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token,remoteip:request.headers.get("cf-connecting-ip")||""})
 });
 if(!response.ok)return false;
 const verification=await response.json();
 return verification.success===true
   && verification.hostname===new URL(request.url).hostname
   && verification.action==="usbrin_application";
}
