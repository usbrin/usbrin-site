import {AuthError} from "../../../_lib/auth-errors.js";
import {nativeReady} from "../../../_lib/native-auth.js";
import {requestPasswordLink} from "../../../_lib/native-password.js";
import {checkOrigin,readBody,respond,error} from "../../../_lib/security.js";

export async function onRequest({request,env}){
  if(request.method!=="POST")return error("Método não permitido.",405);
  if(!nativeReady(request,env))return error("Recurso indisponível.",404);
  if(!checkOrigin(request))return error("Origem não autorizada.",403);
  try{
    const body=await readBody(request,1024);
    if(typeof body.email!=="string"||body.email.length>254)return error("Informe um e-mail válido.",400);
    await requestPasswordLink(request,env,body.email);
    return respond({ok:true,message:"Se este e-mail tiver uma conta ativa, enviaremos um link para definir a senha."},202);
  }catch(e){
    if(e instanceof AuthError)return respond({ok:false,error:e.message,code:e.code},e.status);
    if(e instanceof SyntaxError)return error("Solicitação inválida.",400);
    return error("Não foi possível processar sua solicitação.",503);
  }
}
