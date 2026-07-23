import { loadOsRuntime } from './os-runtime';

export async function readLocalOsSteering(): Promise<string> {
  try {
    const { getSteering } = await loadOsRuntime();
    return getSteering();
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('OS steering failed.');
  }
}

export async function readGuardedLocalOsSteering(callerKey: string): Promise<string> {
  try {
    const { executeGetSteering } = await loadOsRuntime();
    return executeGetSteering(undefined, { callerKey });
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('OS steering failed.');
  }
}
