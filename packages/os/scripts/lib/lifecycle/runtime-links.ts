import { symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type RuntimeDirectoryLinkType = 'dir' | 'junction';

export function runtimeLinkTypeForPlatform(
  platform: NodeJS.Platform = process.platform,
): RuntimeDirectoryLinkType {
  return platform === 'win32' ? 'junction' : 'dir';
}

export function createRuntimeDirectoryLink(input: {
  target: string;
  linkPath: string;
  platform?: NodeJS.Platform;
}): void {
  const type = runtimeLinkTypeForPlatform(input.platform);
  const target =
    type === 'junction'
      ? resolve(dirname(input.linkPath), input.target)
      : input.target;
  symlinkSync(target, input.linkPath, type);
}
