type OsRuntime = typeof import('../../os');
type OsRuntimeImporter = () => Promise<OsRuntime>;

export function createOsRuntimeLoader(
  importRuntime: OsRuntimeImporter = () => import('../../os'),
): () => Promise<OsRuntime> {
  let osRuntimePromise: Promise<OsRuntime> | null = null;

  return function loadRuntime(): Promise<OsRuntime> {
    if (osRuntimePromise) return osRuntimePromise;

    const pending = importRuntime();
    const cached = pending.catch((error: unknown) => {
      if (osRuntimePromise === cached) osRuntimePromise = null;
      throw error;
    });
    osRuntimePromise = cached;
    return cached;
  };
}

export const loadOsRuntime = createOsRuntimeLoader();
