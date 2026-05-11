import path from 'node:path';

import type { ArtifactDescriptor } from './types';

export function createWorkspaceArtifactDescriptor(name: string, type: string): ArtifactDescriptor {
  return {
    name,
    type,
    path: path.posix.join('artifacts', name),
  };
}

