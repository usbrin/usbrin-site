export function applicationAvailability(env, request) {
  const canSubmit = Boolean(env.USBRIN_ID_DB && env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY);
  const general = canSubmit && env.APPLICATIONS_ENABLED === "true";
  const host = request && new URL(request.url).hostname;
  // Only the dedicated recruitment QA alias is allowed to accept reserved test addresses.
  const representativePreview = Boolean(canSubmit
    && host === "ops-representantes-only.usbrin-site.pages.dev");
  return {general, representativePreview};
}

export const isExampleCandidate = address => address.endsWith("@example.com");
