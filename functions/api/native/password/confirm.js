import {AuthError} from "../../../_lib/auth-errors.js";
import {nativeReady} from "../../../_lib/native-auth.js";
import {confirmPasswordLink} from "../../../_lib/native-password.js";
import {checkOrigin,readBody,respond,error} from "../../../_lib/security.js";

export async function onRequest({request,env}){
  if(request.method!=="POST")return error("Método não permitido.",405);
  if(!nativeReady(request,env))return error("Recurso indisponível.",404);
  if(!checkOrigin(request))return error("Origem não autorizada.",403);
  try{
    const body=await readBody(request,2048);
    await confirmPasswordLink(request,env,body.token,body.password);
    return respond({ok:true,message:"Sua senha foi definida com segurança."});
  }catch(e){
    if(e instanceof AuthError)return respond({ok:false,error:e.message,code:e.code},e.status);
    if(e instanceof SyntaxError)return error("Solicitação inválida.",400);
    return error("Não foi possível atualizar sua senha.",503);
  }
}
