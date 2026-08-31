import type { McpNodeRoutingContext } from '../../lib/mcp-node-routing';
import { loadOsRuntime } from './os-runtime';

export async function readLocalOsSteering(): Promise<string> {
  try {
    const { getSteering } = await loadOsRuntime();
    return getSteering();
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('OS steering failed.');
  }
}

export async function readGuardedLocalOsSteering(
  callerKey: string,
  nodeRouting?: McpNodeRoutingContext,
): Promise<string> {
  try {
    const { executeGetSteering, getSteering } = await loadOsRuntime();
    return executeGetSteering(
      () => getSteering({ nodeRouting }),
      { callerKey },
    );
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('OS steering failed.');
  }
}
