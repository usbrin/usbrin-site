import {respond} from "../_lib/security.js";
export function onRequestGet({env}) {
  const enabled=Boolean(env.APPLICATIONS_ENABLED==="true"&&env.DB&&env.TURNSTILE_SECRET&&env.TURNSTILE_SITE_KEY);
  return respond({ok:true,applicationsOpen:enabled,turnstileSiteKey:enabled?env.TURNSTILE_SITE_KEY:null});
}
