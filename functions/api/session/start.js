import {handlePortalSession} from "../../_lib/portal-session.js";
export const onRequest=context=>handlePortalSession(context,"start");
