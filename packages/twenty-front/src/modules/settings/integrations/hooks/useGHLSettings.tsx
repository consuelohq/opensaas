import { useCallback } from 'react';

import { useSetRecoilState } from 'recoil';
import * as Sentry from '@sentry/react';

import { REST_API_BASE_URL } from '@/apollo/constant/rest-api-base-url';
import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { ghlConnectionState } from '@/settings/integrations/states/ghlConnectionState';
import { ghlSyncConfigState } from '@/settings/integrations/states/ghlSyncConfigState';
import { ghlSyncHistoryState } from '@/settings/integrations/states/ghlSyncHistoryState';
import { ghlPushSettingsState } from '@/settings/integrations/states/ghlPushSettingsState';
import { ghlManualSyncProgressState } from '@/settings/integrations/states/ghlManualSyncProgressState';
import { ghlLoadingState } from '@/settings/integrations/states/ghlLoadingState';
import { ghlErrorState } from '@/settings/integrations/states/ghlErrorState';
import type {
  GHLSyncDirection,
  GHLConflictResolution,
  GHLPushSettings,
} from '@/settings/integrations/types/ghl';

const GHL_API_BASE = `${REST_API_BASE_URL}/v1/integrations/ghl`;

const getAuthHeaders = (): Record<string, string> => {
  const tokenPair = getTokenPair();

  if (!tokenPair) {
    return {};
  }

  return {
    Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
    'Content-Type': 'application/json',
  };
};

export const useGHLSettings = () => {
  const setConnection = useSetRecoilState(ghlConnectionState);
  const setSyncConfig = useSetRecoilState(ghlSyncConfigState);
  const setSyncHistory = useSetRecoilState(ghlSyncHistoryState);
  const setPushSettings = useSetRecoilState(ghlPushSettingsState);
  const setSyncProgress = useSetRecoilState(ghlManualSyncProgressState);
  const setLoading = useSetRecoilState(ghlLoadingState);
  const setError = useSetRecoilState(ghlErrorState);

  const fetchConnectionStatus = useCallback(async () => {
    try {
      setLoading('loading');
      const response = await fetch(`${GHL_API_BASE}/status`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch connection status');
      }

      const data = await response.json();

      setConnection(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch connection status';

      Sentry.captureException(err, {
        tags: { component: 'useGHLSettings', operation: 'fetchConnectionStatus' },
      });
      setError(message);
    } finally {
      setLoading('idle');
    }
  }, [setConnection, setLoading, setError]);

  const initiateOAuth = useCallback(async () => {
    try {
      setLoading('loading');
      const response = await fetch(`${GHL_API_BASE}/oauth`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth');
      }

      const data = await response.json();

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to initiate OAuth';

      Sentry.captureException(err, {
        tags: { component: 'useGHLSettings', operation: 'initiateOAuth' },
      });
      setError(message);
    } finally {
      setLoading('idle');
    }
  }, [setLoading, setError]);

  const disconnect = useCallback(async () => {
    try {
      setLoading('loading');
      const response = await fetch(`${GHL_API_BASE}/connection`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setConnection({
        connected: false,
        locationId: null,
        locationName: null,
        connectedAt: null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to disconnect';

      Sentry.captureException(err, {
        tags: { component: 'useGHLSettings', operation: 'disconnect' },
      });
      setError(message);
    } finally {
      setLoading('idle');
    }
  }, [setConnection, setLoading, setError]);

  const fetchSyncConfig = useCallback(async () => {
    try {
      const response = await fetch(`${GHL_API_BASE}/sync/config`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sync config');
      }

      const data = await response.json();

      setSyncConfig(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch sync config';

      Sentry.captureException(err, {
        tags: { component: 'useGHLSettings', operation: 'fetchSyncConfig' },
      });
      setError(message);
    }
  }, [setSyncConfig, setError]);

  const updateSyncDirection = useCallback(
    async (direction: GHLSyncDirection) => {
      try {
        const response = await fetch(`${GHL_API_BASE}/sync/config`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ direction }),
        });

        if (!response.ok) {
          throw new Error('Failed to update sync direction');
        }

        setSyncConfig((prev) => ({ ...prev, direction }));
      } catch (err: unknown) {
        Sentry.captureException(err, {
          tags: { component: 'useGHLSettings', operation: 'updateSyncDirection' },
        });
        throw err;
      }
    },
    [setSyncConfig],
  );

  const updateConflictResolution = useCallback(
    async (conflictResolution: GHLConflictResolution) => {
      try {
        const response = await fetch(`${GHL_API_BASE}/sync/config`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ conflictResolution }),
        });

        if (!response.ok) {
          throw new Error('Failed to update conflict resolution');
        }

        setSyncConfig((prev) => ({ ...prev, conflictResolution }));
      } catch (err: unknown) {
        Sentry.captureException(err, {
          tags: {
            component: 'useGHLSettings',
            operation: 'updateConflictResolution',
          },
        });
        throw err;
      }
    },
    [setSyncConfig],
  );

  const toggleAutoSync = useCallback(
    async (autoSyncEnabled: boolean) => {
      try {
        const response = await fetch(`${GHL_API_BASE}/sync/config`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ autoSyncEnabled }),
        });

        if (!response.ok) {
          throw new Error('Failed to toggle auto sync');
        }

        setSyncConfig((prev) => ({ ...prev, autoSyncEnabled }));
      } catch (err: unknown) {
        Sentry.captureException(err, {
          tags: { component: 'useGHLSettings', operation: 'toggleAutoSync' },
        });
        throw err;
      }
    },
    [setSyncConfig],
  );

  const updateAutoSyncInterval = useCallback(
    async (autoSyncMinutes: number) => {
      try {
        const response = await fetch(`${GHL_API_BASE}/sync/config`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ autoSyncMinutes }),
        });

        if (!response.ok) {
          throw new Error('Failed to update auto sync interval');
        }

        setSyncConfig((prev) => ({ ...prev, autoSyncMinutes }));
      } catch (err: unknown) {
        Sentry.captureException(err, {
          tags: {
            component: 'useGHLSettings',
            operation: 'updateAutoSyncInterval',
          },
        });
        throw err;
      }
    },
    [setSyncConfig],
  );

  const fetchSyncHistory = useCallback(async () => {
    try {
      const response = await fetch(`${GHL_API_BASE}/sync/history`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sync history');
      }

      const data = await response.json();

      setSyncHistory(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch sync history';

      Sentry.captureException(err, {
        tags: { component: 'useGHLSettings', operation: 'fetchSyncHistory' },
      });
      setError(message);
    }
  }, [setSyncHistory, setError]);

  const fetchPushSettings = useCallback(async () => {
    try {
      const response = await fetch(`${GHL_API_BASE}/push-settings`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch push settings');
      }

      const data = await response.json();

      setPushSettings(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch push settings';

      Sentry.captureException(err, {
        tags: { component: 'useGHLSettings', operation: 'fetchPushSettings' },
      });
      setError(message);
    }
  }, [setPushSettings, setError]);

  const savePushSettings = useCallback(
    async (settings: GHLPushSettings) => {
      try {
        const response = await fetch(`${GHL_API_BASE}/push-settings`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(settings),
        });

        if (!response.ok) {
          throw new Error('Failed to save push settings');
        }

        setPushSettings(settings);
      } catch (err: unknown) {
        Sentry.captureException(err, {
          tags: { component: 'useGHLSettings', operation: 'savePushSettings' },
        });
        throw err;
      }
    },
    [setPushSettings],
  );

  const triggerManualSync = useCallback(async () => {
    try {
      setLoading('syncing');
      setSyncProgress({ status: 'running', progress: 0, message: 'Starting sync...' });

      const response = await fetch(`${GHL_API_BASE}/sync`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger sync');
      }

      setSyncProgress({
        status: 'completed',
        progress: 100,
        message: 'Sync completed',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to trigger sync';

      Sentry.captureException(err, {
        tags: { component: 'useGHLSettings', operation: 'triggerManualSync' },
      });
      setSyncProgress({ status: 'failed', progress: 0, message });
      setError(message);
    } finally {
      setLoading('idle');
    }
  }, [setLoading, setSyncProgress, setError]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    fetchConnectionStatus,
    initiateOAuth,
    disconnect,
    fetchSyncConfig,
    updateSyncDirection,
    updateConflictResolution,
    toggleAutoSync,
    updateAutoSyncInterval,
    fetchSyncHistory,
    fetchPushSettings,
    savePushSettings,
    triggerManualSync,
    clearError,
  };
};
