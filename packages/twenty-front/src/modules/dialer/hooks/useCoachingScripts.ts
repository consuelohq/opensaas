import { selectedCoachingScriptIdState } from '@/dialer/states/selectedCoachingScriptIdState';
import { coachingScriptsState } from '@/dialer/states/coachingScriptsState';
import { parseCoachingScript } from '@/dialer/utils/parseCoachingScript';
import { useCallback, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { v4 } from 'uuid';

export const useCoachingScripts = () => {
  const [coachingScripts, setCoachingScripts] =
    useRecoilState(coachingScriptsState);
  const [selectedCoachingScriptId, setSelectedCoachingScriptId] =
    useRecoilState(selectedCoachingScriptIdState);

  const selectedScript = useMemo(
    () => coachingScripts.find((script) => script.id === selectedCoachingScriptId) ?? null,
    [coachingScripts, selectedCoachingScriptId],
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

    setCoachingScripts((currentScripts) => [newScript, ...currentScripts]);
    setSelectedCoachingScriptId(newScript.id);
  }, [setCoachingScripts, setSelectedCoachingScriptId]);

  const updateScript = useCallback(
    (scriptId: string, updates: { name?: string; content?: string }) => {
      setCoachingScripts((currentScripts) =>
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
    [setCoachingScripts],
  );

  const deleteScript = useCallback(
    (scriptId: string) => {
      setCoachingScripts((currentScripts) => {
        const remaining = currentScripts.filter(
          (script) => script.id !== scriptId,
        );

        if (selectedCoachingScriptId === scriptId) {
          setSelectedCoachingScriptId(remaining[0]?.id ?? null);
        }

        return remaining;
      });
    },
    [selectedCoachingScriptId, setCoachingScripts, setSelectedCoachingScriptId],
  );

  const selectedScriptSections = useMemo(
    () => parseCoachingScript(selectedScript),
    [selectedScript],
  );

  return {
    coachingScripts,
    selectedCoachingScriptId,
    setSelectedCoachingScriptId,
    selectedScript,
    selectedScriptSections,
    createScript,
    updateScript,
    deleteScript,
  };
};
