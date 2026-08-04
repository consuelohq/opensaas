import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIALER_STEERING_FILE_NAME = 'dialer-AGENTS.md';

export type VisibleDialerSteeringAction = {
  type: 'seed_steering';
  path: string;
  status: 'planned' | 'created' | 'preserved' | 'updated';
  message: string;
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(currentDir, '..', '..');
const sourcePath = join(packageRoot, 'streams', 'dialer', 'AGENTS.md');

function writeAtomically(target: string, content: string): void {
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, content, { mode: 0o644 });
  renameSync(temporary, target);
}

export function reconcileVisibleDialerSteering(input: {
  userRoot: string;
  dryRun: boolean;
}): VisibleDialerSteeringAction {
  const userRoot = resolve(input.userRoot);
  if (basename(userRoot).toLowerCase() === '.consuelo') {
    throw new Error(
      'Dialer steering must be installed under the visible Consuelo folder',
    );
  }
  const target = join(userRoot, 'Steering', DIALER_STEERING_FILE_NAME);
  const content = readFileSync(sourcePath, 'utf8');
  const existing = existsSync(target) ? readFileSync(target, 'utf8') : null;
  const status = input.dryRun
    ? 'planned'
    : existing === null
      ? 'created'
      : existing === content
        ? 'preserved'
        : 'updated';

  if (!input.dryRun && existing !== content) writeAtomically(target, content);

  return {
    type: 'seed_steering',
    path: target,
    status,
    message:
      'visible dialer agent instructions synchronized from the runtime bundle',
  };
}
