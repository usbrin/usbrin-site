import {AuthError} from "../../_lib/auth.js";
import {nativeReady,nativeLogin} from "../../_lib/native-auth.js";
import {checkOrigin,readBody,respond,error} from "../../_lib/security.js";

export async function onRequest({request,env}){
  if(request.method!=="POST")return error("Método não permitido.",405);
  if(!nativeReady(request,env))return error("Recurso indisponível.",404);
  if(!checkOrigin(request))return error("Origem não autorizada.",403);
  try{
    const body=await readBody(request,2048);
    if(typeof body.email!=="string"||typeof body.password!=="string")
      return error("Informe e-mail e senha.",400);
    const {cookie,user}=await nativeLogin(request,env,body.email,body.password);
    const response=respond({ok:true,user});
    response.headers.append("Set-Cookie",cookie);
    return response;
  }catch(e){
    if(e instanceof AuthError)return respond({ok:false,error:e.message,code:e.code},e.status);
    if(e instanceof SyntaxError)return error("Solicitação inválida.",400);
    return error("Login temporariamente indisponível.",503);
  }
}
