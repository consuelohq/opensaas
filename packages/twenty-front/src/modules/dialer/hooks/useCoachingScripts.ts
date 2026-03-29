import { selectedCoachingScriptIdState } from '@/dialer/states/selectedCoachingScriptIdState';
import { coachingScriptsState } from '@/dialer/states/coachingScriptsState';
import { parseCoachingScript } from '@/dialer/utils/parseCoachingScript';
import { useCallback, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { v4 } from 'uuid';

export const useCoachingScripts = () => {
  const [scripts, setScripts] = useRecoilState(coachingScriptsState);
  const [selectedScriptId, setSelectedScriptId] = useRecoilState(
    selectedCoachingScriptIdState,
  );

  const selectedScript = useMemo(
    () => scripts.find((script) => script.id === selectedScriptId) ?? null,
    [scripts, selectedScriptId],
  );

  const createScript = useCallback(() => {
    const now = new Date().toISOString();
    const newScript = {
      id: v4(),
      name: 'New script',
      content:
        '# Opening\n\nIntroduce yourself and confirm the reason for the call.',
      createdAt: now,
      updatedAt: now,
    };

    setScripts((currentScripts) => [newScript, ...currentScripts]);
    setSelectedScriptId(newScript.id);
  }, [setScripts, setSelectedScriptId]);

  const updateScript = useCallback(
    (scriptId: string, updates: { name?: string; content?: string }) => {
      setScripts((currentScripts) =>
        currentScripts.map((script) =>
          script.id === scriptId
            ? {
                ...script,
                ...updates,
                updatedAt: new Date().toISOString(),
              }
            : script,
        ),
      );
    },
    [setScripts],
  );

  const deleteScript = useCallback(
    (scriptId: string) => {
      setScripts((currentScripts) =>
        currentScripts.filter((script) => script.id !== scriptId),
      );

      if (selectedScriptId === scriptId) {
        const nextScript = scripts.find((script) => script.id !== scriptId);
        setSelectedScriptId(nextScript?.id ?? null);
      }
    },
    [scripts, selectedScriptId, setScripts, setSelectedScriptId],
  );

  const selectedScriptSections = useMemo(
    () => parseCoachingScript(selectedScript),
    [selectedScript],
  );

  return {
    scripts,
    selectedScriptId,
    setSelectedScriptId,
    selectedScript,
    selectedScriptSections,
    createScript,
    updateScript,
    deleteScript,
  };
};
