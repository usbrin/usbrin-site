export function applicationAvailability(env, request) {
  const canSubmit = Boolean(env.USBRIN_ID_DB && env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY);
  const general = canSubmit && env.APPLICATIONS_ENABLED === "true";
  const host = request && new URL(request.url).hostname;
  // Preview recruitment is isolated to Cloudflare Pages preview hostnames and
  // remains restricted to @example.com addresses by the public API.
  const representativePreview = Boolean(canSubmit && host
    && host.endsWith(".usbrin-site.pages.dev")
    && host !== env.ACCESS_APP_HOST);
  return {general, representativePreview};
}

// Reserved example domain keeps the public-facing preview out of real recruitment.
export const isExampleCandidate = address => address.endsWith("@example.com");
