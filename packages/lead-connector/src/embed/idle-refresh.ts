type FocusEventTarget = {
  addEventListener(type: 'focus', listener: () => void): void;
  removeEventListener(type: 'focus', listener: () => void): void;
};

type VisibilityEventTarget = {
  visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
};

export type LeadConnectorIdleRefreshSchedulerInput = {
  windowTarget: FocusEventTarget;
  documentTarget: VisibilityEventTarget;
  refresh: () => void;
};

export type LeadConnectorIdleRefreshScheduler = {
  start: () => void;
  stop: () => void;
};

export const createLeadConnectorIdleRefreshScheduler = (
  input: LeadConnectorIdleRefreshSchedulerInput,
): LeadConnectorIdleRefreshScheduler => {
  let started = false;

  const refreshOnVisible = (): void => {
    if (input.documentTarget.visibilityState === 'visible') input.refresh();
  };

  return {
    start: (): void => {
      if (started) return;
      started = true;
      input.windowTarget.addEventListener('focus', input.refresh);
      input.documentTarget.addEventListener(
        'visibilitychange',
        refreshOnVisible,
      );
    },
    stop: (): void => {
      if (!started) return;
      started = false;
      input.windowTarget.removeEventListener('focus', input.refresh);
      input.documentTarget.removeEventListener(
        'visibilitychange',
        refreshOnVisible,
      );
    },
  };
};
