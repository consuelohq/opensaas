// PostHog helpers — init happens in MarketingLayout.astro inline script
// These functions use the global window.posthog instance

const ph = () => (window as any).posthog;

export function optOut() {
  ph()?.opt_out_capturing();
}

export function identifyUser(email: string, properties?: Record<string, string>) {
  ph()?.identify(email, { email, ...properties });
}

export function setCompany(companyName: string, properties?: Record<string, string>) {
  ph()?.group('company', companyName, properties);
}

export function trackCTAClick(cta: string, href: string) {
  ph()?.capture('cta_click', { cta, href, page: window.location.pathname });
}

export function trackFormSubmit(form: string, data: Record<string, string>) {
  if (data.email) identifyUser(data.email, data);
  ph()?.capture('form_submit', { form, ...data, page: window.location.pathname });
}
