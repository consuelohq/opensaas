import { useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

import { selectedSkillIdState } from '@/agent/states/agentState';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { getTokenPair } from '@/apollo/utils/getTokenPair';

type SkillListItem = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  enabled: boolean;
  folderId: string | null;
};

type SkillFolder = {
  id: string;
  name: string;
  icon: string | null;
};

export const useAgentSkills = () => {
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [folders, setFolders] = useState<SkillFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSkillId, setSelectedSkillId] =
    useRecoilState(selectedSkillIdState);

  const fetchSkills = useCallback(async () => {
    const tokenPair = getTokenPair();

    if (!tokenPair) {
      setIsLoading(false);

      return;
    }

    const headers = {
      Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
    };

    try {
      const [skillsResponse, foldersResponse] = await Promise.all([
        fetch(`${REACT_APP_SERVER_BASE_URL}/v1/agent/skills`, { headers }),
        fetch(`${REACT_APP_SERVER_BASE_URL}/v1/agent/skills/folders`, {
          headers,
        }),
      ]);

      if (skillsResponse.ok) {
        const data = (await skillsResponse.json()) as {
          skills: SkillListItem[];
        };

        setSkills(data.skills ?? []);
      }

      if (foldersResponse.ok) {
        const data = (await foldersResponse.json()) as {
          folders: SkillFolder[];
        };

        setFolders(data.folders ?? []);
      }
    } catch {
      // NOTE: endpoints return 501 until DEV-948 storage layer is wired
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  return {
    skills,
    folders,
    isLoading,
    selectedSkillId,
    setSelectedSkillId,
    refetch: fetchSkills,
  };
};
