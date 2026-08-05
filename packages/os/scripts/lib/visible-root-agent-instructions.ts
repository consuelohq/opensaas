import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_AGENT_INSTRUCTION_FILE_NAMES = [
  'AGENTS.md',
  'CLAUDE.md',
] as const;

export type VisibleRootAgentInstructionAction = {
  type: 'create_file';
  path: string;
  status: 'planned' | 'created' | 'preserved' | 'updated';
  message: string;
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(currentDir, '..', '..');
const sourcePath = join(packageRoot, 'steering', 'root-agent-instructions.md');
const ownerOnlyMode = 0o600;

function hasOwnerOnlyMode(target: string): boolean {
  return process.platform === 'win32' || (statSync(target).mode & 0o777) === ownerOnlyMode;
}

function writeAtomically(target: string, content: string): void {
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, content, { mode: ownerOnlyMode });
  renameSync(temporary, target);
}

export function reconcileVisibleRootAgentInstructions(input: {
  userRoot: string;
  dryRun: boolean;
}): VisibleRootAgentInstructionAction[] {
  const userRoot = resolve(input.userRoot);
  if (basename(userRoot).toLowerCase() === '.consuelo') {
    throw new Error(
      'Root agent instructions must be installed under the visible Consuelo folder',
    );
  }

  const content = readFileSync(sourcePath, 'utf8');
  return ROOT_AGENT_INSTRUCTION_FILE_NAMES.map((fileName) => {
    const target = join(userRoot, fileName);
    const exists = existsSync(target);
    const existing = exists ? readFileSync(target, 'utf8') : null;
    const currentModeIsOwnerOnly = exists ? hasOwnerOnlyMode(target) : false;
    const status = input.dryRun
      ? 'planned'
      : !exists
        ? 'created'
        : existing === content && currentModeIsOwnerOnly
          ? 'preserved'
          : 'updated';

    if (!input.dryRun) {
      if (existing !== content) writeAtomically(target, content);
      else if (!currentModeIsOwnerOnly && process.platform !== 'win32') {
        chmodSync(target, ownerOnlyMode);
      }
    }

    return {
      type: 'create_file',
      path: target,
      status,
      message:
        'visible root agent instructions synchronized from the runtime bundle',
    };
  });
}
