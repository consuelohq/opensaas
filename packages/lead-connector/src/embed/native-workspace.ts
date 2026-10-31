import type { WorkspaceLaunch } from './workspace-launch.js';

/** Sidebar presentation only. This never grants readiness or starts media. */
export const createNativeWorkspaceLauncher = (options: {
  open: (launch: WorkspaceLaunch) => void;
  onOpened: () => void;
  newId: () => string;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (timer: number) => void;
}) => {
  let launch: WorkspaceLaunch | null = null;
  let timer: number | undefined;
  let attempted = false;
  let attempts = 0;
  const cancel = () => {
    if (timer !== undefined) options.cancel(timer);
    timer = undefined;
  };
  const send = () => {
    if (!launch) return;
    options.open(launch);
    if (++attempts < 4) timer = options.schedule(send, 2000);
  };
  const open = () => {
    cancel();
    attempted = true;
    attempts = 0;
    launch = { id: options.newId(), mode: 'inbound', action: 'open' };
    send();
  };
  return {
    requestOnce: () => {
      if (!attempted) open();
    },
    open,
    acknowledge: (id: string) => {
      if (launch?.id !== id) return;
      cancel();
      launch = null;
      options.onOpened();
    },
    dispose: () => {
      cancel();
      launch = null;
    },
  };
};
