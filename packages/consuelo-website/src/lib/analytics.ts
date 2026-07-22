// PostHog helpers — init happens in MarketingLayout.astro inline script
// These functions use the global window.posthog instance

type PostHogClient = {
  identify?: (email: string, properties?: Record<string, string>) => void;
  group?: (groupType: string, groupKey: string, properties?: Record<string, string>) => void;
  capture?: (eventName: string, properties?: Record<string, string>) => void;
};

declare global {
  interface Window {
    posthog?: PostHogClient;
  }
}
const ph = () => window.posthog;

export function identifyUser(email: string, properties?: Record<string, string>) {
  ph()?.identify?.(email, { email, ...properties });
}

export function setCompany(companyName: string, properties?: Record<string, string>) {
  ph()?.group?.('company', companyName, properties);
}

export function trackCTAClick(cta: string, href: string) {
  ph()?.capture?.('cta_click', { cta, href, page: window.location.pathname });
}

export function trackFormSubmit(form: string, data: Record<string, string>) {
  if (data.email) identifyUser(data.email, data);
  ph()?.capture?.('form_submit', { form, ...data, page: window.location.pathname });
}
