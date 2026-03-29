import { captureException } from '@sentry/react';
import { useCallback, useEffect, useState } from 'react';

import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type BillingMode = 'hosted' | 'byok';
export type PlanStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'none';

export type WorkspaceSubscriptionStatus = {
  workspaceId: string;
  mode: BillingMode;
  plan: {
    name: string;
    status: PlanStatus;
    interval: 'month' | 'year' | null;
    currentPeriodEnd: string | null;
  };
  usage: {
    callMinutes: { used: number; limit: number | null };
    aiTokens: { used: number; limit: number | null };
  };
  stripeCustomerId: string | null;
};

export const useWorkspaceSubscriptionStatus = () => {
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<WorkspaceSubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptionStatus = useCallback(async () => {
    setLoading(true);

    try {
      const response = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/subscription/status`,
      );

      if (response.status === 401) {
        setSubscriptionStatus(null);
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Failed to fetch subscription status: ${response.status}`,
        );
      }

      const result = (await response.json()) as WorkspaceSubscriptionStatus;

      setSubscriptionStatus(result);
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'useWorkspaceSubscriptionStatus' },
      });
      setSubscriptionStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  return {
    subscriptionStatus,
    loading,
    refetchSubscriptionStatus: fetchSubscriptionStatus,
  };
};
