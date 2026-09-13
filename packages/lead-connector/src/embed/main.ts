import './styles.css';
import { resolveLeadConnectorSurface } from './surface.js';

const surface = resolveLeadConnectorSurface(window.location.pathname);
document.body.dataset.surface = surface;

const fail = (cause: unknown) => {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) return;
  const message = cause instanceof Error ? cause.message : 'The dialer could not start.';
  root.innerHTML = `<main class="customer-shell"><section class="customer-card"><h1>Unavailable</h1><p>${message.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p></section></main>`;
};

if (surface === 'customer') {
  void import('./customer-main.js')
    .then(({ startCustomerEntry }) => startCustomerEntry())
    .catch((cause: unknown) => fail(cause));
} else {
  void import('./internal-main.js').catch((cause: unknown) => fail(cause));
}
