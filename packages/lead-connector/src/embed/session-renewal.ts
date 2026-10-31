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
      if (attempts < 3) request();
      else {
        exhausted = true;
        options.onExhausted();
      }
    }, 8000);
  };
  function check() {
    if (expires !== null && options.now() >= (renewAt ?? expires)) request();
    else arm();
  }
  const succeeded = (iso: string | null) => {
    const parsed = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(parsed) || parsed <= options.now()) return;
    expires = parsed;
    renewAt = parsed - Math.min(90000, (parsed - options.now()) * 0.1);
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
