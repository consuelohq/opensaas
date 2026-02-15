import { useCallback, useEffect, useRef, useState } from 'react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

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
  } catch {
    // fall through
  }
  return DEFAULT_PREFERENCES;
};

const saveToStorage = (prefs: UserPreferences) => {
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
};

export const useUserPreferences = () => {
  const [preferences, setPreferences] =
    useState<UserPreferences>(loadFromStorage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // fetch from API on mount, fall back to localStorage
  useEffect(() => {
    mountedRef.current = true;
    const fetchPrefs = async () => {
      try {
        const res = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/settings/preferences`,
          { credentials: 'include' },
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as UserPreferences;
        if (mountedRef.current) {
          const merged = { ...DEFAULT_PREFERENCES, ...data };
          setPreferences(merged);
          saveToStorage(merged);
        }
      } catch {
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
        const res = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/settings/preferences`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(prefs),
          },
        );
        if (!res.ok) throw new Error(`${res.status}`);
        setError(null);
      } catch {
        // silent — localStorage is the fallback
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
      setPreferences((prev) => {
        const next = { ...prev, ...patch };
        saveToStorage(next);
        persistToApi(next);
        return next;
      });
    },
    [persistToApi],
  );

  return { preferences, updatePreferences, loading, error };
};
