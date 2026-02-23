import { useCallback, useEffect, useState } from 'react';

import { REST_API_BASE_URL } from '@/apollo/constant/rest-api-base-url';
import { getTokenPair } from '@/apollo/utils/getTokenPair';

type UsageSummary = {
  meters: Record<string, number>;
  periodStart: string;
  periodEnd: string;
};

type UsageBreakdownEntry = {
  meter: string;
  total: number;
};

type UsageBreakdown = {
  entries: UsageBreakdownEntry[];
  periodStart: string;
  periodEnd: string;
};

export const useAgentUsage = () => {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [breakdown, setBreakdown] = useState<UsageBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    const tokenPair = getTokenPair();

    if (!tokenPair) {
      setIsLoading(false);

      return;
    }

    const headers = {
      Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
    };

    try {
      const [summaryResponse, breakdownResponse] = await Promise.all([
        fetch(`${REST_API_BASE_URL}/v1/agent/automations/usage`, { headers }),
        fetch(`${REST_API_BASE_URL}/v1/agent/automations/usage/breakdown`, {
          headers,
        }),
      ]);

      if (summaryResponse.ok) {
        const data = (await summaryResponse.json()) as UsageSummary;

        setSummary(data);
      }

      if (breakdownResponse.ok) {
        const data = (await breakdownResponse.json()) as UsageBreakdown;

        setBreakdown(data);
      }
    } catch {
      // non-critical — usage display can fail silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsage();
  }, [fetchUsage]);

  return {
    summary,
    breakdown,
    isLoading,
    refetch: fetchUsage,
  };
};
