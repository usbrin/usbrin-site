import {respond,error,readBody,checkOrigin,verifiedTurnstile,email,str} from "../_lib/security.js";
import {applicationAvailability,isExampleCandidate} from "../_lib/application-availability.js";

const types=new Set(["representante","desenvolvedor"]);
const states=new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
const fields={name:120,email:180,phone:40,city:100,state:2,experience:2600,motivation:1800,portfolio:350,availability:100};

export async function onRequestPost({request,env}){
  const {general,representativePreview}=applicationAvailability(env,request);
  if(!general&&!representativePreview)return error("Inscrições ainda não estão abertas.",503);
  if(!checkOrigin(request))return error("Origem não autorizada.",403);
  let b;try{b=await readBody(request,16000);}catch{return error("Dados da candidatura inválidos.");}
  if(str(b.website))return error("Candidatura inválida.",400);
  const type=str(b.type,20);
  if(!types.has(type))return error("Selecione uma modalidade válida.");
  if(!general&&type!=="representante")return error("Inscrições desta modalidade ainda não estão abertas.",503);
  const representative=type==="representante";
  for(const [key,max] of Object.entries(fields)){
    if(representative&&["portfolio","availability"].includes(key))continue;
    if(b[key]!==undefined&&(typeof b[key]!=="string"||b[key].trim().length>max))
      return error("Confira o tamanho e o formato dos campos.");
  }
  const name=str(b.name,120),mail=email(b.email),rawPhone=str(b.phone,40),city=str(b.city,100);
  const state=str(b.state,2).toUpperCase(),experience=str(b.experience,2600),motivation=str(b.motivation,1800);
  const phone=representative?rawPhone.replace(/[\s().-]/g,""):rawPhone;
  const portfolio=representative?"":str(b.portfolio,350),availability=representative?"":str(b.availability,100);
  if(name.length<3||!/[\p{L}]/u.test(name)||!city||!/[\p{L}]/u.test(city)||!states.has(state)||experience.length<20||motivation.length<20||b.privacy!==true)
    return error("Confira nome, cidade, estado, respostas e o aceite de privacidade.");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))return error("Informe um e-mail válido.");
  if(representative?!/^(?:\+?55)?[1-9]\d[2-9]\d{7,8}$/.test(phone):phone.length<8)
    return error("Informe um WhatsApp válido com DDD.");
  if(!general&&!isExampleCandidate(mail))return error("Use um e-mail fictício terminado em @example.com nesta homologação.");
  if(portfolio){
    try{if(new URL(portfolio).protocol!=="https:")throw Error();}
    catch{return error("Use um link HTTPS para o portfólio.");}
  }
  try{if(!await verifiedTurnstile(b.turnstileToken,env,request))return error("Confirmação de segurança inválida. Tente novamente.",403);}catch{return error("Não foi possível validar a segurança.",503);}
  const id=crypto.randomUUID(),protocol="U"+id.replace(/-/g,"").slice(0,13).toUpperCase();
  const db=env.USBRIN_ID_DB;
  try{
    // The existing partial unique index arbitrates simultaneous submissions.
    await db.batch([
      db.prepare("INSERT INTO applications (id,protocol,type,name,email,phone,city,state,experience,motivation,portfolio,availability,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'received',datetime('now'),datetime('now'))")
        .bind(id,protocol,type,name,mail,phone,city,state,experience,motivation,portfolio,availability),
      db.prepare("INSERT INTO audit_events (id,action,entity,entity_id,details,created_at) VALUES (?,'application.privacy','application',?,?,datetime('now'))")
        .bind(crypto.randomUUID(),id,"privacidade-parceiros/v1")
    ]);
    return respond({ok:true,protocol,status:"received"},201);
  }catch(e){
    if(/UNIQUE constraint failed: applications\.email, applications\.type/i.test(String(e)))
      return error("Já existe uma candidatura ativa para este e-mail e modalidade. Consulte o protocolo anterior.",409);
    return error("Não foi possível registrar sua candidatura. Tente mais tarde.",500);
  }
}
export function onRequestGet(){return error("Método não permitido.",405);}
