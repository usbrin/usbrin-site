// Application channels remain fail-closed unless Turnstile, D1 and an exact host are configured.
export function applicationAvailability(env, request) {
  const canSubmit=Boolean(env.USBRIN_ID_DB && env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY);
  const general=canSubmit && env.APPLICATIONS_ENABLED === "true";
  const host=request && new URL(request.url).hostname;
  const representativePreview=Boolean(canSubmit && host && host === env.REPRESENTATIVE_APPLICATIONS_PREVIEW
    && host === env.ACCESS_APP_HOST);
  // Independent, representative-only public rollout. Explicit host prevents
  // accidentally activating forms on preview deployment aliases or other sites.
  const representativePublic=Boolean(canSubmit && host && env.REPRESENTATIVE_APPLICATIONS_ENABLED==="true"
    && host===env.REPRESENTATIVE_APPLICATIONS_HOST);
  // Candidate tracking stays available after a campaign closes, but only
  // with a separate explicit flag, approved host and functioning Turnstile.
  const representativeStatus=Boolean(canSubmit && host && env.REPRESENTATIVE_STATUS_ENABLED==="true"
    && host===env.REPRESENTATIVE_APPLICATIONS_HOST);
  return {general,representativePreview,representativePublic,representativeStatus};
}

// Reserved example domain keeps a private preview out of real recruitment.
export const isExampleCandidate=address=>address.endsWith("@example.com");
