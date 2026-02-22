import { useCallback, useEffect, useState } from 'react';

import { REST_API_BASE_URL } from '@/apollo/constant/rest-api-base-url';
import { getTokenPair } from '@/apollo/utils/getTokenPair';

type AutomationRun = {
  id: string;
  automationId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  triggerPayload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
};

const authHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${getTokenPair()?.accessOrWorkspaceAgnosticToken.token}`,
});

export const useAutomationHistory = (automationId: string | null) => {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!automationId) {
      setRuns([]);

      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${REST_API_BASE_URL}/v1/agent/automations/${automationId}/runs`,
        { headers: authHeaders() },
      );

      if (response.ok) {
        const data = (await response.json()) as { runs: AutomationRun[] };

        setRuns(data.runs);
      }
    } catch {
      // non-critical — history list can fail silently
    } finally {
      setIsLoading(false);
    }
  }, [automationId]);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  const selectRun = useCallback(
    (runId: string | null) => {
      setSelectedRun(
        runId ? (runs.find((r) => r.id === runId) ?? null) : null,
      );
    },
    [runs],
  );

  return {
    runs,
    isLoading,
    selectedRun,
    selectRun,
    refetch: fetchRuns,
  };
};
