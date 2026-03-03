import { useCallback, useState } from 'react';

import { useSetRecoilState } from 'recoil';
import * as Sentry from '@sentry/react';

import { REST_API_BASE_URL } from '@/apollo/constant/rest-api-base-url';
import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { ghlPipelineMappingsState } from '@/settings/integrations/states/ghlPipelineMappingsState';
import type {
  GHLPipelineStage,
  GHLPipelineStageMapping,
  TwentyPipelineStage,
} from '@/settings/integrations/types/ghl';

const GHL_PIPELINES_API = `${REST_API_BASE_URL}/v1/integrations/ghl/pipelines`;

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

export const useGHLPipelineMappings = () => {
  const setMappings = useSetRecoilState(ghlPipelineMappingsState);
  const [ghlStages, setGhlStages] = useState<GHLPipelineStage[]>([]);
  const [twentyStages, setTwentyStages] = useState<TwentyPipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPipelines = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(GHL_PIPELINES_API, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pipelines');
      }

      const data = await response.json();

      setGhlStages(data.ghlStages ?? []);
      setTwentyStages(data.twentyStages ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch pipelines';

      Sentry.captureException(err, {
        tags: {
          component: 'useGHLPipelineMappings',
          operation: 'fetchPipelines',
        },
      });
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    try {
      const response = await fetch(`${GHL_PIPELINES_API}/mappings`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pipeline mappings');
      }

      const data = await response.json();

      setMappings(data.mappings ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch pipeline mappings';

      Sentry.captureException(err, {
        tags: {
          component: 'useGHLPipelineMappings',
          operation: 'fetchMappings',
        },
      });
      setError(message);
    }
  }, [setMappings]);

  const saveMappings = useCallback(
    async (mappings: GHLPipelineStageMapping[]) => {
      try {
        setIsSaving(true);
        setError(null);

        const response = await fetch(`${GHL_PIPELINES_API}/mappings`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ mappings }),
        });

        if (!response.ok) {
          throw new Error('Failed to save pipeline mappings');
        }

        setMappings(mappings);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to save pipeline mappings';

        Sentry.captureException(err, {
          tags: {
            component: 'useGHLPipelineMappings',
            operation: 'saveMappings',
          },
        });
        setError(message);
      } finally {
        setIsSaving(false);
      }
    },
    [setMappings],
  );

  const triggerSync = useCallback(async () => {
    try {
      setIsSyncing(true);
      setError(null);

      const response = await fetch(`${GHL_PIPELINES_API}/sync`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger pipeline sync');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to trigger pipeline sync';

      Sentry.captureException(err, {
        tags: {
          component: 'useGHLPipelineMappings',
          operation: 'triggerSync',
        },
      });
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    ghlStages,
    twentyStages,
    isLoading,
    isSaving,
    isSyncing,
    error,
    fetchPipelines,
    fetchMappings,
    saveMappings,
    triggerSync,
  };
};
