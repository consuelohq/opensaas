/** Pure decisions for safe, per-rep workspace restoration. No session authority is persisted. */
export const canRestoreWorkspacePreferences = (
  scope: string | null,
  appliedScope: string | null,
  activeCalling: boolean,
): boolean => Boolean(scope && scope !== appliedScope && !activeCalling);

export const canPersistWorkspacePreferences = (
  scope: string | null,
  appliedScope: string | null,
  authenticated: boolean,
  activeCalling: boolean,
): boolean =>
  Boolean(scope && scope === appliedScope && authenticated && !activeCalling);

/** Undefined means the rep explicitly chose no manual script. */
export const selectScriptIdAfterReload = (
  selectedId: string | undefined,
  scripts: ReadonlyArray<{ id: string }>,
): string | undefined =>
  selectedId !== undefined && !scripts.some((script) => script.id === selectedId)
    ? scripts[0]?.id
    : selectedId;
