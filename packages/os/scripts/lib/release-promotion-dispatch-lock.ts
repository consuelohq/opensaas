import path from 'node:path';

import { resolveConsueloHomeLayout } from './consuelo-home';
import { nodeResourceLockPath, withNodeResourceLock } from './node-resource-lock';

export function releasePromotionDispatchLockPath(home?: string): string {
  return nodeResourceLockPath(
    path.join(resolveConsueloHomeLayout(home).nodeRunsDir, 'release-promotion-dispatch'),
  );
}

export async function withReleasePromotionDispatchLock<T>(
  input: {
    operationId: string;
    home?: string;
    waitTimeoutMs?: number;
  },
  operation: () => Promise<T>,
): Promise<T> {
  return withNodeResourceLock({
    lockPath: releasePromotionDispatchLockPath(input.home),
    operationId: input.operationId,
    ...(input.waitTimeoutMs === undefined ? {} : { waitTimeoutMs: input.waitTimeoutMs }),
  }, operation);
}
