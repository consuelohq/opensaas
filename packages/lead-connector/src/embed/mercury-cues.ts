// Presentation input only. A transport adapter must validate domain card patches first.
export type MercuryCueView = {
  scopeKey: string;
  revision: number;
  heading: string;
  kind: 'approved' | 'manual';
  status: 'live' | 'manual' | 'delayed' | 'reconnecting' | 'unavailable';
  points: readonly {
    slotId: string;
    text: string;
    exact: string;
    source: string;
  }[];
};
export type MercuryCueSource = (
  scopeKey: string,
  receive: (view: MercuryCueView) => void,
) => () => void;

export const createMercuryCueSession = (
  changed: (view: MercuryCueView | null) => void,
) => {
  let generation = 0;
  let scope: string | null = null;
  let latest: MercuryCueView | null = null;
  let visible: MercuryCueView | null = null;
  let pinned = false;
  let manual = false;
  let stop: (() => void) | undefined;
  const publish = (view: MercuryCueView | null) => {
    if (visible === view) return;
    visible = view;
    changed(view);
  };
  const reset = () => {
    generation++;
    stop?.();
    stop = undefined;
    scope = null;
    latest = null;
    pinned = false;
    manual = false;
    publish(null);
  };
  return {
    connect: (scopeKey: string, source: MercuryCueSource) => {
      reset();
      scope = scopeKey;
      const epoch = generation;
      stop = source(scopeKey, (view) => {
        if (
          epoch !== generation ||
          view.scopeKey !== scope ||
          !Number.isSafeInteger(view.revision) ||
          view.revision < 0 ||
          (latest && view.revision <= latest.revision)
        )
          return;
        latest = view;
        if (!pinned && !manual) publish(view);
      });
    },
    current: () => visible,
    setPinned: (value: boolean) => {
      pinned = value;
      if (!pinned && !manual) publish(latest);
    },
    setManual: (view: MercuryCueView) => {
      if (view.scopeKey !== scope) return;
      manual = true;
      publish(view);
    },
    returnToAuto: () => {
      manual = false;
      pinned = false;
      publish(latest);
    },
    dispose: reset,
  };
};
