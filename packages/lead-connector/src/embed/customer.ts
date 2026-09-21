export type CustomerServiceWindow = {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
};

export type CustomerEntrySnapshot = {
  publicId: string;
  phoneNumber: string;
  timezone: string;
  staffAvailableNow: boolean;
  callback: {
    available: boolean;
    disclosure: string | null;
    serviceWindows: CustomerServiceWindow[];
  };
};

export type CustomerCallbackResult = {
  managementToken?: string;
  callback: {
    status: string;
    notBefore?: string;
    deadline?: string;
  };
  booking: {
    status: 'unavailable' | 'requested' | 'confirmed' | 'cancelled' | 'cancel_pending';
    providerReference?: string | null;
    evidenceReference?: string | null;
  };
};

export type CustomerCallbackRequest = {
  phoneNumber: string;
  permissionAccepted: true;
  mode: 'immediate' | 'scheduled';
  serviceWindowId?: string;
};

type CustomerApi = {
  load: (publicId: string) => Promise<CustomerEntrySnapshot>;
  requestCallback: (
    publicId: string,
    input: CustomerCallbackRequest & { idempotencyKey: string },
  ) => Promise<CustomerCallbackResult>;
  readCallback: (
    publicId: string,
    managementToken: string,
  ) => Promise<CustomerCallbackResult>;
  rescheduleCallback: (
    publicId: string,
    managementToken: string,
    serviceWindowId: string,
  ) => Promise<CustomerCallbackResult>;
  cancelCallback: (
    publicId: string,
    managementToken: string,
  ) => Promise<CustomerCallbackResult>;
};

export type CustomerEntryState = {
  phase: 'loading' | 'ready' | 'submitting' | 'error';
  snapshot: CustomerEntrySnapshot | null;
  result: CustomerCallbackResult | null;
  error: string | null;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderBookingTruth = (
  result: CustomerCallbackResult | null,
  snapshot: CustomerEntrySnapshot,
): string => {
  if (!result) return '';
  const booking = result.booking;
  const cancelled = result.callback.status === 'cancelled';
  const cancellationPending =
    result.callback.status === 'cancel_pending' || booking.status === 'cancel_pending';
  const confirmed =
    booking.status === 'confirmed' &&
    Boolean(booking.providerReference) &&
    Boolean(booking.evidenceReference);
  const terminalMessage = result.callback.status === 'fulfilled'
    ? { title: 'Callback completed', detail: 'This callback has been completed.' }
    : result.callback.status === 'expired'
      ? { title: 'Callback window expired', detail: 'The service window ended before we could complete your callback. You can call us or request another callback.' }
      : result.callback.status === 'exhausted'
        ? { title: 'Callback attempts finished', detail: 'We could not complete your callback within the allowed attempts. You can call us or request another callback.' }
        : null;
  const canManage = !terminalMessage && !cancelled && !cancellationPending;
  const title = terminalMessage?.title ?? (cancelled
    ? 'Callback cancelled'
    : cancellationPending
      ? 'Cancellation pending'
      : confirmed
        ? 'Appointment confirmed'
        : 'Callback requested');
  const detail = terminalMessage?.detail ?? (cancelled
    ? 'This callback has been cancelled.'
    : cancellationPending
      ? 'We are confirming the cancellation. It has not been marked complete yet.'
      : confirmed
        ? 'The calendar provider returned confirmation evidence.'
    : booking.status === 'requested'
      ? 'The booking request is still awaiting provider confirmation.'
      : booking.status === 'unavailable'
        ? 'This is a callback request, not a confirmed calendar appointment.'
        : 'The callback obligation reflects the latest server state.');
  const reschedule =
    result.managementToken &&
    canManage &&
    snapshot.callback.serviceWindows.length
      ? `<form data-form="customer-reschedule" class="customer-form customer-reschedule">
          <label>Move callback to a staffed service window
            <select name="serviceWindowId">${snapshot.callback.serviceWindows
              .map(
                (window) =>
                  `<option value="${escapeHtml(window.id)}">${escapeHtml(window.label)}</option>`,
              )
              .join('')}</select>
          </label>
          <button class="button button--secondary" type="submit">Reschedule callback</button>
        </form>`
      : '';
  return `<section class="customer-result" aria-live="polite">
    <p class="eyebrow">Request status</p>
    <h2>${title}</h2>
    <p>${detail}</p>
    ${
      result.managementToken && !cancelled
        ? `<div class="customer-manage"><button class="button button--secondary" type="button" data-action="customer-refresh">Refresh status</button>${canManage ? '<button class="button button--danger" type="button" data-action="customer-cancel">Cancel callback</button>' : ''}</div>`
        : ''
    }
    ${reschedule}
  </section>`;
};

export const renderCustomerEntry = (state: CustomerEntryState): string => {
  if (state.phase === 'loading' || !state.snapshot) {
    return `<main class="customer-shell"><section class="customer-card"><p>Loading call options…</p></section></main>`;
  }
  const snapshot = state.snapshot;
  const windows = snapshot.callback.serviceWindows
    .map(
      (window) =>
        `<option value="${escapeHtml(window.id)}">${escapeHtml(window.label)}</option>`,
    )
    .join('');
  const callback = snapshot.callback.available
    ? `<section class="customer-card customer-card--callback">
        <p class="eyebrow">Callback</p>
        <h2>Request a callback</h2>
        <p>We’ll call as soon as staffed capacity permits. We do not promise a wait-time estimate.</p>
        ${
          snapshot.callback.disclosure
            ? `<p class="customer-disclosure">${escapeHtml(snapshot.callback.disclosure)}</p>`
            : ''
        }
        <form data-form="customer-callback" class="customer-form">
          <label>Phone number<input name="phoneNumber" type="tel" autocomplete="tel" inputmode="tel" required /></label>
          <fieldset>
            <legend>When should we call?</legend>
            <label class="customer-choice"><input type="radio" name="mode" value="immediate" checked />As soon as staffed capacity permits</label>
            ${
              snapshot.callback.serviceWindows.length
                ? `<label class="customer-choice"><input type="radio" name="mode" value="scheduled" />Choose a staffed service window</label>
                   <label>Service window<select name="serviceWindowId">${windows}</select></label>`
                : ''
            }
          </fieldset>
          <label class="customer-choice customer-permission"><input name="permissionAccepted" type="checkbox" required />I’m asking this team to call the number above about this request.</label>
          <button class="button button--primary" type="submit" ${state.phase === 'submitting' ? 'disabled' : ''}>Request callback</button>
        </form>
      </section>`
    : '';
  return `<main class="customer-shell">
    <section class="customer-card customer-card--hero">
      <p class="eyebrow">Call us</p>
      <h1>Talk with our team</h1>
      <p>${
        snapshot.staffAvailableNow
          ? 'Staff are available right now.'
          : 'No staff are available right now. You can still call or use an available callback option.'
      }</p>
      <a class="button button--primary customer-call-link" href="tel:${escapeHtml(snapshot.phoneNumber)}">Call ${escapeHtml(snapshot.phoneNumber)}</a>
      <p class="customer-timezone">Service times are shown in ${escapeHtml(snapshot.timezone)}.</p>
    </section>
    ${callback}
    ${state.error ? `<p class="customer-error" role="alert">${escapeHtml(state.error)}</p>` : ''}
    ${renderBookingTruth(state.result, snapshot)}
  </main>`;
};

export const createCustomerEntryApi = (input: {
  baseUrl: string;
  fetch?: (
    request: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
}): CustomerApi => {
  const fetchCustomer = input.fetch ?? fetch;
  const request = async <T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> => {
    try {
      const response = await fetchCustomer(new URL(path, input.baseUrl), init);
      const body = (await response.json()) as
        | T
        | {
            error?: {
              code?: unknown;
              message?: unknown;
              retryable?: unknown;
            };
          };
      if (!response.ok) {
        const publicError = (body as {
          error?: { code?: unknown; message?: unknown; retryable?: unknown };
        }).error;
        const message =
          publicError && typeof publicError.message === 'string'
            ? publicError.message
            : 'Customer request failed';
        const error = new Error(message) as Error & {
          code?: string;
          retryable?: boolean;
        };
        if (publicError && typeof publicError.code === 'string')
          error.code = publicError.code;
        if (publicError && typeof publicError.retryable === 'boolean')
          error.retryable = publicError.retryable;
        throw error;
      }
      return body as T;
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer request failed', { cause });
    }
  };
  const callbackHeaders = (managementToken: string): HeadersInit => ({
    authorization: `Callback ${managementToken}`,
    'content-type': 'application/json',
  });
  const entry = (publicId: string) =>
    `/v1/inbound/customer/${encodeURIComponent(publicId)}`;
  return {
    load: (publicId) => request<CustomerEntrySnapshot>(entry(publicId)),
    requestCallback: (publicId, body) =>
      request<CustomerCallbackResult>(entry(publicId) + '/callbacks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    readCallback: (publicId, managementToken) =>
      request<CustomerCallbackResult>(entry(publicId) + '/callbacks/status', {
        headers: callbackHeaders(managementToken),
      }),
    rescheduleCallback: (publicId, managementToken, serviceWindowId) =>
      request<CustomerCallbackResult>(entry(publicId) + '/callbacks/reschedule', {
        method: 'POST',
        headers: callbackHeaders(managementToken),
        body: JSON.stringify({ serviceWindowId }),
      }),
    cancelCallback: (publicId, managementToken) =>
      request<CustomerCallbackResult>(entry(publicId) + '/callbacks/cancel', {
        method: 'POST',
        headers: callbackHeaders(managementToken),
        body: '{}',
      }),
  };
};

export const createCustomerEntryController = (options: {
  publicId: string;
  api: CustomerApi;
  createIdempotencyKey?: () => string;
}) => {
  let state: CustomerEntryState = {
    phase: 'loading',
    snapshot: null,
    result: null,
    error: null,
  };
  const listeners = new Set<(next: CustomerEntryState) => void>();
  let inFlight: Promise<CustomerCallbackResult> | null = null;
  let pendingRequest: { fingerprint: string; idempotencyKey: string } | null = null;
  const emit = () => {
    for (const listener of listeners) listener(state);
  };
  const update = (next: CustomerEntryState) => {
    state = next;
    emit();
  };
  const load = async (): Promise<CustomerEntrySnapshot> => {
    try {
      const snapshot = await options.api.load(options.publicId);
      update({ phase: 'ready', snapshot, result: state.result, error: null });
      return snapshot;
    } catch (cause: unknown) {
      const error = cause instanceof Error ? cause.message : 'Customer entry failed';
      update({ phase: 'error', snapshot: state.snapshot, result: state.result, error });
      throw cause;
    }
  };
  const requestCallback = (
    input: CustomerCallbackRequest,
  ): Promise<CustomerCallbackResult> => {
    if (inFlight) return inFlight;
    const fingerprint = JSON.stringify(input);
    if (pendingRequest?.fingerprint !== fingerprint) {
      pendingRequest = {
        fingerprint,
        idempotencyKey:
          options.createIdempotencyKey?.() ?? crypto.randomUUID(),
      };
    }
    const idempotencyKey = pendingRequest.idempotencyKey;
    update({ ...state, phase: 'submitting', error: null });
    inFlight = options.api
      .requestCallback(options.publicId, { ...input, idempotencyKey })
      .then((result) => {
        pendingRequest = null;
        update({ ...state, phase: 'ready', result, error: null });
        return result;
      })
      .catch((cause: unknown) => {
        const error = cause instanceof Error ? cause.message : 'Callback request failed';
        update({ ...state, phase: 'ready', error });
        throw cause;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
  const requireToken = (): string => {
    const token = state.result?.managementToken;
    if (!token) throw new Error('Callback management capability is unavailable');
    return token;
  };
  const projectManagementFailure = (cause: unknown, fallback: string): never => {
    const error = cause instanceof Error ? cause : new Error(fallback, { cause });
    update({ ...state, phase: 'ready', error: error.message });
    throw error;
  };
  const readCallback = async () => {
    try {
      const result = await options.api.readCallback(options.publicId, requireToken());
      update({ ...state, phase: 'ready', result, error: null });
      return result;
    } catch (cause: unknown) {
      return projectManagementFailure(
        cause,
        'Callback status rejected with a non-Error cause',
      );
    }
  };
  const rescheduleCallback = async (serviceWindowId: string) => {
    try {
      const result = await options.api.rescheduleCallback(
        options.publicId,
        requireToken(),
        serviceWindowId,
      );
      update({ ...state, phase: 'ready', result, error: null });
      return result;
    } catch (cause: unknown) {
      return projectManagementFailure(
        cause,
        'Callback reschedule rejected with a non-Error cause',
      );
    }
  };
  const cancelCallback = async () => {
    try {
      const result = await options.api.cancelCallback(
        options.publicId,
        requireToken(),
      );
      update({ ...state, phase: 'ready', result, error: null });
      return result;
    } catch (cause: unknown) {
      return projectManagementFailure(
        cause,
        'Callback cancellation rejected with a non-Error cause',
      );
    }
  };
  const restoreManagementToken = async (managementToken: string) => {
    try {
      const result = await options.api.readCallback(
        options.publicId,
        managementToken,
      );
      const restored = { ...result, managementToken };
      update({ ...state, phase: 'ready', result: restored, error: null });
      return restored;
    } catch (cause: unknown) {
      return projectManagementFailure(
        cause,
        'Callback restore rejected with a non-Error cause',
      );
    }
  };
  return {
    getState: () => state,
    subscribe: (listener: (next: CustomerEntryState) => void) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    load,
    requestCallback,
    readCallback,
    rescheduleCallback,
    cancelCallback,
    restoreManagementToken,
  };
};
