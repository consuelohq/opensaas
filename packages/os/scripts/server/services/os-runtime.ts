let osRuntimePromise: Promise<typeof import('../../os')> | null = null;

export function loadOsRuntime(): Promise<typeof import('../../os')> {
  osRuntimePromise ??= import('../../os');
  return osRuntimePromise;
}
