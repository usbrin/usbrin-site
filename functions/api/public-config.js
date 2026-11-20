import {respond} from "../_lib/security.js";
import {applicationAvailability} from "../_lib/application-availability.js";

export function onRequestGet({env,request}){
 const {general,representativePreview,representativePublic,representativeStatus}=applicationAvailability(env,request);
 const canVerify=Boolean(env.USBRIN_ID_DB&&env.TURNSTILE_SECRET&&env.TURNSTILE_SITE_KEY);
 const applicationsOpen=general||representativePublic||representativePreview;
 const applicationStatusOpen=applicationsOpen||representativeStatus;
 const studioInquiriesOpen=canVerify&&env.STUDIO_INQUIRIES_ENABLED==="true";
 return respond({ok:true,applicationsOpen,applicationStatusOpen,applicationTypes:general?["representante","desenvolvedor"]:(representativePublic||representativePreview)?["representante"]:[],
   representativePreview:representativePreview&&!general&&!representativePublic,studioInquiriesOpen,
   turnstileSiteKey:(applicationStatusOpen||studioInquiriesOpen)?env.TURNSTILE_SITE_KEY:null});
}
