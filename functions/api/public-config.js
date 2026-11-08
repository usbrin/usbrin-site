import {respond} from "../_lib/security.js";
export function onRequestGet({env}){
 const canVerify=Boolean(env.DB&&env.TURNSTILE_SECRET&&env.TURNSTILE_SITE_KEY);
 const applicationsOpen=canVerify&&env.APPLICATIONS_ENABLED==="true";
 const studioInquiriesOpen=canVerify&&env.STUDIO_INQUIRIES_ENABLED==="true";
 return respond({ok:true,applicationsOpen,studioInquiriesOpen,
   turnstileSiteKey:(applicationsOpen||studioInquiriesOpen)?env.TURNSTILE_SITE_KEY:null});
}
