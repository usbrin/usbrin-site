export function applicationAvailability(env, request) {
  const canSubmit = Boolean(env.USBRIN_ID_DB && env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY);
  const general = canSubmit && env.APPLICATIONS_ENABLED === "true";
  const host = request && new URL(request.url).hostname;
  const representativePreview = Boolean(canSubmit && host && host === env.REPRESENTATIVE_APPLICATIONS_PREVIEW
    && host === env.ACCESS_APP_HOST);
  return {general, representativePreview};
}

// Reserved example domain keeps the public-facing preview out of real recruitment.
export const isExampleCandidate = address => address.endsWith("@example.com");
