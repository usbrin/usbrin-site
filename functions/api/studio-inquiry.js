import {respond,error,readBody,checkOrigin,verifiedTurnstile,email,str} from "../_lib/security.js";
// A customer explicitly submits this form; preparing a Studio estimate never contacts this endpoint.
// Default off in every environment. A preliminary estimate is NOT an accepted price.
const validProducts=new Set(["landing","business","catalogo"]);
export async function onRequestPost({request,env}){
 if(env.STUDIO_INQUIRIES_ENABLED!=="true"||!env.DB||!env.TURNSTILE_SITE_KEY||!env.TURNSTILE_SECRET){
   return error("O envio direto ainda não está disponível. Utilize o WhatsApp ou e-mail.",503);
 }
 if(!checkOrigin(request))return error("Origem não autorizada.",403);
 let b;try{b=await readBody(request,10000)}catch{return error("Confira os campos da solicitação.",400)}
 if(str(b.website,100))return error("Não foi possível registrar a solicitação.",400); // honeypot
 const name=str(b.name,90),company=str(b.company,100),mail=email(b.email),phone=str(b.phone,40);
 const goal=str(b.goal,700),notes=str(b.notes,700),briefing=str(b.briefing,4200);
 const product=str(b.product,20),value=b.estimateCents,key=str(b.idempotencyKey,40);
 if(name.length<3||goal.length<8||briefing.length<25||!validProducts.has(product)||
    !Number.isSafeInteger(value)||value<0||value>100000000||
    !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(key)||b.consent!==true){
      return error("Preencha a solicitação e confirme o tratamento dos dados.",400);
 }
 if(!mail&&!phone)return error("Informe pelo menos um contato: e-mail ou WhatsApp.",400);
 if(mail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))return error("E-mail inválido.",400);
 if(phone&&phone.replace(/\D/g,"").length<10)return error("WhatsApp inválido.",400);
 try{
   if(!await verifiedTurnstile(b.turnstileToken,env,request,"usbrin_studio")){
     return error("Verificação de segurança inválida. Tente novamente.",403);
   }
 }catch{return error("Serviço de segurança temporariamente indisponível.",503)}
 const id=crypto.randomUUID(),protocol="S"+id.replace(/-/g,"").slice(0,13).toUpperCase();
 try{
   const previous=await env.DB.prepare("SELECT protocol FROM studio_inquiries WHERE idempotency_key=?").bind(key).first();
   if(previous)return respond({ok:true,protocol:previous.protocol,duplicate:true},200);
   await env.DB.prepare(`INSERT INTO studio_inquiries
     (id,protocol,idempotency_key,name,company,email,phone,goal,notes,briefing,product,estimate_cents,consent_version)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,protocol,key,name,company,mail||null,phone||null,goal,notes||null,briefing,product,value,"studio-intake-v1").run();
   return respond({ok:true,protocol,status:"new"},201);
 }catch(e){
   if(/UNIQUE|constraint/i.test(String(e)))return error("Essa solicitação já foi registrada. Confira antes de tentar novamente.",409);
   return error("Não conseguimos registrar sua solicitação agora. Utilize o WhatsApp ou e-mail.",500);
 }
}
export function onRequestGet(){return error("Método não permitido.",405)}
