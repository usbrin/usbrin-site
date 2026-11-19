import {nativeEnabled} from "../../_lib/native-auth.js";
import {zitadelEnabled} from "../../_lib/zitadel-auth.js";
import {respond,error} from "../../_lib/security.js";

// Public capability flags only. Do not expose identity providers, API URLs or secrets.
export function onRequest({request,env}){
  if(request.method!=="GET")return error("Método não permitido.",405);
  const mode=zitadelEnabled(env)?"zitadel":nativeEnabled(env)?"native":"access";
  return respond({ok:true,mode,passwordRecovery:mode==="native"&&
    env.USBRIN_PASSWORD_EMAIL_ENABLED==="true"});
}
