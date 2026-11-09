import {respond} from "../_lib/security.js";
import {applicationAvailability} from "../_lib/application-availability.js";

export function onRequestGet({env,request}){
 const {general,representativePreview}=applicationAvailability(env,request);
 const canVerify=Boolean(env.USBRIN_ID_DB&&env.TURNSTILE_SECRET&&env.TURNSTILE_SITE_KEY);
 const applicationsOpen=general||representativePreview;
 const studioInquiriesOpen=canVerify&&env.STUDIO_INQUIRIES_ENABLED==="true";
 return respond({ok:true,applicationsOpen,applicationTypes:general?["representante","desenvolvedor"]:representativePreview?["representante"]:[],
   representativePreview:representativePreview&&!general,studioInquiriesOpen,
   turnstileSiteKey:(applicationsOpen||studioInquiriesOpen)?env.TURNSTILE_SITE_KEY:null});
}
