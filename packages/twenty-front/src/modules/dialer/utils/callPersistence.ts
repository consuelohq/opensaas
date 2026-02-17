const STORAGE_KEY = 'dialer_active_call';

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export type PersistedCallState = {
  callSid: string;
  conferenceName: string;
  fromNumber: string;
  toNumber: string;
  timestamp: number;
};

export const persistCallState = (state: PersistedCallState): void => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage unavailable (e.g., private browsing)
  }
};

export const getPersistedCallState = (): PersistedCallState | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedCallState;

    if (
      typeof parsed.callSid !== 'string' ||
      typeof parsed.conferenceName !== 'string' ||
      typeof parsed.fromNumber !== 'string' ||
      typeof parsed.toNumber !== 'string' ||
      typeof parsed.timestamp !== 'number'
    ) {
      return null;
    }

    if (Date.now() - parsed.timestamp > STALE_THRESHOLD_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const clearPersistedCallState = (): void => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage unavailable
  }
};
