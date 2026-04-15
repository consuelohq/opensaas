import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
} from '@/settings/types/preferences';
import type { UserPreferences } from '@/settings/types/preferences';

const DEBOUNCE_MS = 1000;

const loadFromStorage = (): UserPreferences => {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch (err: unknown) {
    void err;
    // fall through
  }
  return DEFAULT_PREFERENCES;
};

const saveToStorage = (prefs: UserPreferences) => {
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
};

let sharedPreferences = loadFromStorage();
const preferenceListeners = new Set<() => void>();

const emitPreferencesChange = () => {
  for (const listener of preferenceListeners) {
    listener();
  }
};

const getPreferencesSnapshot = () => sharedPreferences;

const subscribeToPreferences = (listener: () => void) => {
  preferenceListeners.add(listener);

  return () => {
    preferenceListeners.delete(listener);
  };
};

const setSharedPreferences = (prefs: UserPreferences) => {
  sharedPreferences = prefs;
  saveToStorage(prefs);
  emitPreferencesChange();
};

export const useUserPreferences = () => {
  const preferences = useSyncExternalStore(
    subscribeToPreferences,
    getPreferencesSnapshot,
    getPreferencesSnapshot,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // fetch from API on mount, fall back to localStorage
  useEffect(() => {
    mountedRef.current = true;
    const fetchPrefs = async () => {
      try {
        const res = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/settings/preferences`,
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as UserPreferences;
        if (mountedRef.current) {
          const merged = { ...DEFAULT_PREFERENCES, ...data };
          setSharedPreferences(merged);
        }
      } catch (err: unknown) {
        void err;
        // API unavailable — localStorage values already loaded
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    void fetchPrefs();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // debounced save to API
  const persistToApi = useCallback((prefs: UserPreferences) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/settings/preferences`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prefs),
          },
        );
        if (!res.ok) throw new Error(`${res.status}`);
        setError(null);
      } catch (err: unknown) {
        void err;
        setError('Failed to save preferences');
      }
    }, DEBOUNCE_MS);
  }, []);

  // cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updatePreferences = useCallback(
    (patch: Partial<UserPreferences>) => {
      const next = { ...getPreferencesSnapshot(), ...patch };
      setSharedPreferences(next);
      persistToApi(next);
    },
    [persistToApi],
  );

  return { preferences, updatePreferences, loading, error };
};
