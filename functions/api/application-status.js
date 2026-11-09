import {respond,error,readBody,checkOrigin,verifiedTurnstile,email,str} from "../_lib/security.js";
import {applicationAvailability,isExampleCandidate} from "../_lib/application-availability.js";
// Status-only lookup: does not reveal full name, resume, interview notes or contact details.
export async function onRequestPost({request,env}){
 const {general,representativePreview}=applicationAvailability(env,request);
 if(!general&&!representativePreview)return error("Consulta de candidaturas indisponível.",503);
 if(!checkOrigin(request))return error("Origem não autorizada.",403);
 let data;try{data=await readBody(request,5000)}catch{return error("Dados inválidos.",400)}
 const protocol=str(data.protocol,20).toUpperCase(),mail=email(data.email);
 if(!/^U[A-F0-9]{13}$/.test(protocol)||!mail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))return error("Confira o protocolo e o e-mail.",400);
 if(!general&&!isExampleCandidate(mail))return error("Use o e-mail fictício da candidatura em homologação.",400);
 try{if(!await verifiedTurnstile(data.turnstileToken,env,request,"usbrin_status"))return error("Verificação de segurança inválida.",403)}catch{return error("Serviço de segurança indisponível.",503)}
 try{
   const record=await env.USBRIN_ID_DB.prepare("SELECT status,updated_at FROM applications WHERE protocol=? AND email=? AND (?=1 OR type='representante')").bind(protocol,mail,Number(general)).first();
   if(!record)return error("Não foi encontrada candidatura com esses dados.",404);
   return respond({ok:true,status:record.status,updatedAt:record.updated_at});
 }catch{return error("Não foi possível consultar agora.",500)}
}
export function onRequestGet(){return error("Método não permitido.",405)}
