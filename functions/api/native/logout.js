import {AuthError} from "../../_lib/auth.js";
import {nativeReady,nativeLogout} from "../../_lib/native-auth.js";
import {checkOrigin,respond,error} from "../../_lib/security.js";

export async function onRequest({request,env}){
  if(request.method!=="POST")return error("Método não permitido.",405);
  if(!nativeReady(request,env))return error("Recurso indisponível.",404);
  if(!checkOrigin(request))return error("Origem não autorizada.",403);
  try{
    const cleared=await nativeLogout(request,env);
    const response=respond({ok:true});
    response.headers.append("Set-Cookie",cleared);
    return response;
  }catch(e){
    if(e instanceof AuthError)return respond({ok:false,error:e.message,code:e.code},e.status);
    return error("Não foi possível encerrar a sessão.",503);
  }
}
