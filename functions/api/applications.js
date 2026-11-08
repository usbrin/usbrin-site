import {respond,error,readBody,checkOrigin,verifiedTurnstile,email,str} from "../_lib/security.js";
const types=new Set(["representante","desenvolvedor"]);
export async function onRequestPost({request,env}){
  if(env.APPLICATIONS_ENABLED!=="true"||!env.USBRIN_ID_DB||!env.TURNSTILE_SECRET||!env.TURNSTILE_SITE_KEY)return error("Inscrições ainda não estão abertas.",503);
  if(!checkOrigin(request))return error("Origem não autorizada.",403);
  let b;try{b=await readBody(request,12000);}catch{return error("Dados da candidatura inválidos.");}
  if(str(b.website))return error("Candidatura inválida.",400); // invisible honeypot
  const type=str(b.type,20),name=str(b.name,120),mail=email(b.email),phone=str(b.phone,40),city=str(b.city,100),state=str(b.state,2).toUpperCase(),experience=str(b.experience,2600),motivation=str(b.motivation,1800),portfolio=str(b.portfolio,350),availability=str(b.availability,100);
  if(!types.has(type)||name.length<3||!mail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)||phone.length<8||!city||!state.match(/^[A-Z]{2}$/)||experience.length<20||motivation.length<20||b.privacy!==true)return error("Confira os campos obrigatórios e a declaração de privacidade.");
  if(portfolio&&!/^https:\/\//i.test(portfolio))return error("Use um link HTTPS para o portfólio.");
  try{if(!await verifiedTurnstile(b.turnstileToken,env,request))return error("Confirmação de segurança inválida. Tente novamente.",403);}catch{return error("Não foi possível validar a segurança.",503);}
  const id=crypto.randomUUID(),protocol="U"+id.replace(/-/g,"").slice(0,13).toUpperCase();
  try{
    const duplicate=await env.USBRIN_ID_DB.prepare("SELECT id FROM applications WHERE email=? AND type=? AND status NOT IN ('rejected','withdrawn') LIMIT 1").bind(mail,type).first();
    if(duplicate)return error("Já existe uma candidatura ativa para este e-mail e modalidade.",409);
    await env.USBRIN_ID_DB.prepare("INSERT INTO applications (id,protocol,type,name,email,phone,city,state,experience,motivation,portfolio,availability,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'received',datetime('now'),datetime('now'))").bind(id,protocol,type,name,mail,phone,city,state,experience,motivation,portfolio,availability).run();
    return respond({ok:true,protocol,status:"received"},201);
  }catch(e){
    if(String(e).includes("UNIQUE"))return error("Já existe uma candidatura com esses dados.",409);
    return error("Não foi possível registrar sua candidatura. Tente mais tarde.",500);
  }
}
export function onRequestGet(){return error("Método não permitido.",405);}
