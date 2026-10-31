const requests = new WeakMap();
export const checkoutRequestsFor = (context) => requests.get(context);
export const newCheckoutFixtureContext = async (browser, options) => {
  let context;
  try {
    context = await browser.newContext(options);
    const captured = [];
    requests.set(context, captured);
    await context.addInitScript(() => {
      const enable = () => {
        const settings = document.querySelector(
          '[data-stripe-checkout-settings]',
        );
        if (settings) {
          settings.dataset.stripeCheckoutEnabled = 'true';
          return true;
        }
        return false;
      };
      const observer = new MutationObserver(() => {
        if (enable()) observer.disconnect();
      });
      if (!enable())
        observer.observe(document, { childList: true, subtree: true });
    });
    // Every provider-facing route is local fixture data; ordinary browser tests never create live sessions.
    await context.route(
      'https://calls.consuelohq.com/v1/public/billing/**',
      async (route) => {
        const origin = route.request().headers().origin || 'null';
        const headers = {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'content-type,x-purchase-claim',
        };
        if (route.request().method() === 'OPTIONS')
          return route.fulfill({ status: 204, headers });
        if (
          route.request().method() === 'POST' &&
          new URL(route.request().url()).pathname ===
            '/v1/public/billing/checkout'
        ) {
          const payload = route.request().postDataJSON();
          captured.push(payload);
          return route.fulfill({
            headers,
            contentType: 'application/json',
            body: JSON.stringify({
              id: payload.requestId,
              url: 'https://checkout.stripe.com/c/pay/cs_browser_fixture',
            }),
          });
        }
        return route.fulfill({
          status: 404,
          headers,
          contentType: 'application/json',
          body: '{}',
        });
      },
    );
    await context.route('https://checkout.stripe.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>Simulated Stripe</title><h1>Stripe Checkout fixture</h1>',
      }),
    );
    await context.route('https://app.gohighlevel.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>Simulated GoHighLevel</title><h1>GoHighLevel fixture</h1>',
      }),
    );
    await context.route('https://billing.stripe.com/p/login/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>Simulated Stripe billing</title><h1>Stripe billing login fixture</h1>',
      }),
    );
    return context;
  } catch (cause) {
    if (context) await context.close().catch(() => undefined);
    if (cause instanceof Error) throw cause;
    throw new Error(String(cause));
  }
};
