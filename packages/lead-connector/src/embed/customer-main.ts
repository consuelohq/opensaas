import {
  createCustomerEntryApi,
  createCustomerEntryController,
  renderCustomerEntry,
} from './customer.js';

const publicIdFromPath = () => {
  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments.length !== 2 || segments[0] !== 'call' || !segments[1])
    throw new Error('Customer entry URL is invalid');
  return decodeURIComponent(segments[1]);
};

export const startCustomerEntry = (): void => {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Customer entry root is missing');
  const publicId = publicIdFromPath();
  document.title = 'Call us';
  const api = createCustomerEntryApi({ baseUrl: window.location.origin });
  const controller = createCustomerEntryController({ publicId, api });
  const storageKey = `consuelo-callback:${publicId}`;

  controller.subscribe((state) => {
    root.innerHTML = renderCustomerEntry(state);
    const token = state.result?.managementToken;
    if (token) sessionStorage.setItem(storageKey, token);
    if (state.result?.callback.status === 'cancelled')
      sessionStorage.removeItem(storageKey);
  });

  root.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    const data = new FormData(form);
    if (form.dataset.form === 'customer-callback') {
      const mode = data.get('mode') === 'scheduled' ? 'scheduled' : 'immediate';
      const permissionAccepted = data.get('permissionAccepted') === 'on';
      const phoneNumber = String(data.get('phoneNumber') ?? '').trim();
      const serviceWindowId = String(data.get('serviceWindowId') ?? '').trim();
      if (!permissionAccepted || !phoneNumber) return;
      void controller.requestCallback({
        phoneNumber,
        permissionAccepted: true,
        mode,
        ...(mode === 'scheduled' && serviceWindowId
          ? { serviceWindowId }
          : {}),
      }).catch(() => undefined);
      return;
    }
    if (form.dataset.form === 'customer-reschedule') {
      const serviceWindowId = String(data.get('serviceWindowId') ?? '').trim();
      if (serviceWindowId)
        void controller.rescheduleCallback(serviceWindowId).catch(() => undefined);
    }
  });

  root.addEventListener('click', (event) => {
    const target =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>('[data-action]')
        : null;
    const action = target?.dataset.action;
    if (action === 'customer-refresh')
      void controller.readCallback().catch(() => undefined);
    if (action === 'customer-cancel')
      void controller.cancelCallback().catch(() => undefined);
  });

  void controller.load().then(async () => {
    const token = sessionStorage.getItem(storageKey);
    if (!token) return;
    try {
      await controller.restoreManagementToken(token);
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }).catch(() => undefined);
};
