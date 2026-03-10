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
import { ghlImportProgressState } from '@/settings/integrations/states/ghlImportProgressState';
import { ghlLoadingState } from '@/settings/integrations/states/ghlLoadingState';
import { ghlErrorState } from '@/settings/integrations/states/ghlErrorState';
import type {
  GHLSyncDirection,
  GHLConflictResolution,
  GHLPushSettings,
  GHLSyncLogEntry,
} from '@/settings/integrations/types/ghl';

const GHL_API_BASE = `${REST_API_BASE_URL}/v1/integrations/leadconnector`;

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
  const setImportProgress = useSetRecoilState(ghlImportProgressState);
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

  // fetch sync log from GET /sync/log (richer data than /sync/history)
  const fetchSyncHistory = useCallback(async () => {
    try {
      const response = await fetch(`${GHL_API_BASE}/sync/log?limit=50`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sync log');
      }

      const data = (await response.json()) as { logs: GHLSyncLogEntry[] };

      setSyncHistory(data.logs ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch sync log';

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

  const triggerManualSync = useCallback(
    async (tags?: string[]) => {
      try {
        setLoading('syncing');
        setSyncProgress({ status: 'running', progress: 0, message: 'Starting sync...' });

        const body: Record<string, unknown> = {};
        if (tags && tags.length > 0) {
          body.tags = tags;
        }

        const response = await fetch(`${GHL_API_BASE}/sync`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error('Failed to trigger sync');
        }

        const data = await response.json();

        setSyncProgress({
          status: 'completed',
          progress: 100,
          message: `Sync completed — ${data.importedCount ?? 0} imported, ${data.updatedCount ?? 0} updated`,
        });

        // refresh sync log after sync completes
        await fetchSyncHistory();
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
    },
    [setLoading, setSyncProgress, setError, fetchSyncHistory],
  );

  // trigger full import from GHL with optional tag filtering
  const triggerImport = useCallback(
    async (tags?: string[]) => {
      try {
        setLoading('importing');
        setImportProgress({
          status: 'running',
          progress: 10,
          message: 'Importing contacts from GHL...',
        });

        const body: Record<string, unknown> = {};
        if (tags && tags.length > 0) {
          body.tags = tags;
        }

        const response = await fetch(`${GHL_API_BASE}/import`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error('Failed to import contacts');
        }

        const data = await response.json();

        setImportProgress({
          status: 'completed',
          progress: 100,
          message: `Import completed — ${data.importedCount ?? 0} imported, ${data.updatedCount ?? 0} updated, ${data.skippedCount ?? 0} skipped`,
        });

        // refresh sync log after import completes
        await fetchSyncHistory();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to import contacts';

        Sentry.captureException(err, {
          tags: { component: 'useGHLSettings', operation: 'triggerImport' },
        });
        setImportProgress({ status: 'failed', progress: 0, message });
        setError(message);
      } finally {
        setLoading('idle');
      }
    },
    [setLoading, setImportProgress, setError, fetchSyncHistory],
  );

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
    triggerImport,
    clearError,
  };
};
