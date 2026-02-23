import { useCallback, useEffect, useMemo, useState } from 'react';

import { REST_API_BASE_URL } from '@/apollo/constant/rest-api-base-url';
import { getTokenPair } from '@/apollo/utils/getTokenPair';

type SkillVersion = {
  id: string;
  skillId: string;
  version: number;
  systemPrompt: string | null;
  sandboxTemplate: string | null;
  changeSummary: string | null;
  createdBy: string | null;
  createdAt: string;
};

export const useSkillVersions = (skillId: string | null) => {
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!skillId) {
      return;
    }

    const tokenPair = getTokenPair();

    if (!tokenPair) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${REST_API_BASE_URL}/v1/agent/skills/${skillId}/versions`,
        {
          headers: {
            Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
          },
        },
      );

      if (response.ok) {
        const data = (await response.json()) as { versions: SkillVersion[] };

        setVersions(data.versions ?? []);
      }
    } catch {
      // NOTE: endpoint returns 501 until storage layer is wired
    } finally {
      setIsLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

  const latestVersion = useMemo(
    () => (versions.length > 0 ? versions[0] : null),
    [versions],
  );

  return { versions, isLoading, latestVersion, refetch: fetchVersions };
};
