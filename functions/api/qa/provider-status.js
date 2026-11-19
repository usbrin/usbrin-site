// Temporary isolated QA-only provider connectivity probe.
// Checks a deliberately nonexistent session; does not handle user credentials,
// access any real identity, create a session, or reveal service tokens.
export async function onRequest({request,env}){
  const u=new URL(request.url);
  const allowed=request.method==="POST"&&u.protocol==="https:"&&
    u.hostname==="usbrin-id-native-qa.pages.dev"&&
    request.headers.get("origin")==="https://usbrin-id-native-qa.pages.dev"&&
    env.USBRIN_AUTH_MODE==="zitadel"&&
    env.ZITADEL_API_URL==="https://usbrin-id-rzf8mn.us1.zitadel.cloud"&&
    typeof env.ZITADEL_LOGIN_CLIENT_TOKEN==="string"&&
    env.ZITADEL_LOGIN_CLIENT_TOKEN.length>=32;
  if(!allowed)return new Response(null,{status:404});
  let outcome="unavailable";
  try{
    const r=await fetch(env.ZITADEL_API_URL+"/v2/sessions/qa-does-not-exist-20261119",{
      method:"GET",
      redirect:"error",
      signal:AbortSignal.timeout(6000),
      headers:{authorization:"Bearer "+env.ZITADEL_LOGIN_CLIENT_TOKEN,accept:"application/json"}
    });
    outcome="HTTP_"+r.status;
    await r.body?.cancel();
  }catch(e){
    const type=String(e?.name||"Unknown");
    outcome=/^(AbortError|TimeoutError|TypeError)$/.test(type)?type:"OtherFailure";
  }
  return Response.json({qa:true,providerStatus:outcome},{headers:{
    "cache-control":"no-store, private",
    "x-robots-tag":"noindex, nofollow",
    "x-content-type-options":"nosniff"
  }});
}
