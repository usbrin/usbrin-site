// USBRIN Partners API helpers
export const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export const error=(message,status=400)=>respond({ok:false,error:message},status);
export const email=value=>String(value||'').trim().toLowerCase();
export const str=(value,max=255)=>typeof value==='string'?value.trim().slice(0,max):'';
export async function readBody(request,max=12000){const text=await request.text();if(text.length>max)throw new Error('Muito grande');return JSON.parse(text);}
export function checkOrigin(request){const origin=request.headers.get('origin');return !!origin&&origin===new URL(request.url).origin;}
export async function verifiedTurnstile(token,env,request){if(!env.TURNSTILE_SECRET||!token)return false;const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:String(token)})});if(!response.ok)return false;const data=await response.json();return data.success===true&&data.hostname===new URL(request.url).hostname;}
