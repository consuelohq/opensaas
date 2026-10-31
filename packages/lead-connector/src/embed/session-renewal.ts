const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 3;

export const createSessionRenewal = (options: {
  now: () => number;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (id: number) => void;
  requestContext: () => void;
  onExhausted: () => void;
}) => {
  let renewAt: number | null = null,
    expires: number | null = null,
    timer: number | undefined,
    deadline: number | undefined,
    pending = false,
    attempts = 0,
    exhausted = false,
    disposed = false;
  const clear = (id: number | undefined) => {
    if (id !== undefined) options.cancel(id);
  };
  const arm = () => {
    clear(timer);
    if (disposed || expires === null || pending || exhausted) return;
    timer = options.schedule(
      check,
      Math.max(0, Math.min(86400000, (renewAt ?? expires) - options.now())),
    );
  };
  const request = () => {
    if (disposed || pending || exhausted) return;
    clear(timer);
    pending = true;
    attempts++;
    options.requestContext();
    deadline = options.schedule(() => {
      pending = false;
      if (attempts < MAX_ATTEMPTS) request();
      else {
        exhausted = true;
        options.onExhausted();
      }
    }, REQUEST_TIMEOUT_MS);
  };
  function check() {
    if (expires !== null && options.now() >= (renewAt ?? expires)) request();
    else arm();
  }
  const succeeded = (iso: string | null) => {
    const parsed = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(parsed) || parsed <= options.now()) return;
    expires = parsed;
    const ttl = parsed - options.now();
    const retryBudget = MAX_ATTEMPTS * REQUEST_TIMEOUT_MS;
    const lead = Math.min(90_000, Math.max(retryBudget, ttl * 0.1));
    // Keep a positive spacing for very short TTLs to avoid instant success
    // loops; when ttl >= retryBudget, reserve all three request deadlines.
    renewAt = Math.max(
      options.now() + Math.min(1_000, ttl * 0.05),
      parsed - lead,
    );
    pending = false;
    attempts = 0;
    exhausted = false;
    clear(deadline);
    deadline = undefined;
    arm();
  };
  return {
    request,
    check,
    succeeded,
    observe: (iso: string | null) => {
      if (iso && Date.parse(iso) !== expires) succeeded(iso);
    },
    retry: () => {
      clear(deadline);
      pending = false;
      attempts = 0;
      exhausted = false;
      request();
    },
    dispose: () => {
      disposed = true;
      clear(timer);
      clear(deadline);
    },
  };
};
