import os from 'node:os';
import path from 'node:path';

import { readManifest } from './manifest';
import type { OsManifestEntry, PermissionLevel } from './types';

export type GuardrailAction = 'read' | 'write' | 'delete' | 'execute';
export type GuardrailStatus =
  | 'connected'
  | 'permission_denied'
  | 'approval_required'
  | 'validation_failed';

export type GuardrailDecision = {
  allowed: boolean;
  status: GuardrailStatus;
  code: string;
  message: string;
  target?: string;
};

export type LocalPathAccessInput = {
  action: Exclude<GuardrailAction, 'execute'>;
  targetPath: string;
  osHome: string;
  userHome?: string;
};

export type ShellCommandAccessInput = {
  command: string;
};

export type ManifestGuardrailIssue = {
  skill: string;
  code: string;
  message: string;
};

const ELEVATED_PERMISSIONS = new Set<PermissionLevel>([
  'write',
  'execute',
  'external',
  'admin',
]);
const DESTRUCTIVE_COMMAND_PATTERNS = [
  /\brm\s+-[^\n;|&]*r[^\n;|&]*f\s+(?:\/|~|\$HOME|\.\.)/,
  /\brm\s+-[^\n;|&]*f[^\n;|&]*r\s+(?:\/|~|\$HOME|\.\.)/,
  /\bchmod\s+-R\s+777\s+(?:\/|~|\$HOME)/,
  /\bchown\s+-R\s+[^\n;|&]+\s+(?:\/|~|\$HOME)/,
  /\bmkfs\b/,
  /\bdd\s+.*\bof=\/dev\//,
];

function normalizeAbsolute(filePath: string): string {
  const expanded =
    filePath === '~' || filePath.startsWith('~/')
      ? path.join(os.homedir(), filePath.slice(filePath === '~' ? 1 : 2))
      : filePath;
  return path.resolve(expanded);
}

export function isPathInside(parentPath: string, childPath: string): boolean {
  const parent = normalizeAbsolute(parentPath);
  const child = normalizeAbsolute(childPath);
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function sensitiveRoots(
  userHome: string,
): Array<{ root: string; label: string }> {
  return [
    { root: path.join(userHome, '.ssh'), label: 'SSH keys' },
    { root: path.join(userHome, '.gnupg'), label: 'GPG keys' },
    { root: path.join(userHome, 'Library', 'Keychains'), label: 'Keychains' },
    {
      root: path.join(
        userHome,
        'Library',
        'Application Support',
        'Google',
        'Chrome',
      ),
      label: 'browser profile data',
    },
    {
      root: path.join(userHome, 'Library', 'Application Support', 'Firefox'),
      label: 'browser profile data',
    },
    { root: '/System', label: 'system directory' },
    { root: '/Library', label: 'system library' },
    { root: '/bin', label: 'system binary directory' },
    { root: '/sbin', label: 'system binary directory' },
    { root: '/usr/bin', label: 'system binary directory' },
    { root: '/usr/sbin', label: 'system binary directory' },
    { root: '/etc', label: 'system configuration' },
  ];
}

function deny(
  code: string,
  message: string,
  target?: string,
): GuardrailDecision {
  return { allowed: false, status: 'permission_denied', code, message, target };
}

function approval(
  code: string,
  message: string,
  target?: string,
): GuardrailDecision {
  return { allowed: false, status: 'approval_required', code, message, target };
}

function allow(
  code: string,
  message: string,
  target?: string,
): GuardrailDecision {
  return { allowed: true, status: 'connected', code, message, target };
}

export function assessLocalPathAccess(
  input: LocalPathAccessInput,
): GuardrailDecision {
  const target = normalizeAbsolute(input.targetPath);
  const osHome = normalizeAbsolute(input.osHome);
  const userHome = normalizeAbsolute(input.userHome ?? os.homedir());

  if (input.action === 'delete' && target === osHome) {
    return deny(
      'OS_HOME_DELETE_BLOCKED',
      'OS home cannot be deleted through the OS portal.',
      target,
    );
  }

  for (const sensitiveRoot of sensitiveRoots(userHome)) {
    if (isPathInside(sensitiveRoot.root, target)) {
      return deny(
        'SENSITIVE_PATH_BLOCKED',
        `${input.action} is blocked for ${sensitiveRoot.label}.`,
        target,
      );
    }
  }

  if (isPathInside(osHome, target)) {
    return allow(
      'OS_HOME_ACCESS_ALLOWED',
      `${input.action} is allowed inside OS home.`,
      target,
    );
  }

  return approval(
    'OUTSIDE_OS_HOME_REQUIRES_APPROVAL',
    `${input.action} outside OS home requires explicit approval.`,
    target,
  );
}

export function assessShellCommandAccess(
  input: ShellCommandAccessInput,
): GuardrailDecision {
  const command = input.command.trim();
  if (command.length === 0) {
    return {
      allowed: false,
      status: 'validation_failed',
      code: 'EMPTY_COMMAND',
      message: 'Command is required.',
    };
  }

  if (DESTRUCTIVE_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
    return deny(
      'DESTRUCTIVE_COMMAND_BLOCKED',
      'Destructive local commands are blocked by OS guardrails.',
    );
  }

  return approval(
    'SHELL_COMMAND_REQUIRES_APPROVAL',
    'Shell command execution requires explicit approval.',
  );
}

export function validateManifestGuardrails(
  entries: OsManifestEntry[] = readManifest(),
): ManifestGuardrailIssue[] {
  const issues: ManifestGuardrailIssue[] = [];

  for (const entry of entries) {
    if (ELEVATED_PERMISSIONS.has(entry.permission) && !entry.requiresApproval) {
      issues.push({
        skill: entry.name,
        code: 'ELEVATED_PERMISSION_REQUIRES_APPROVAL',
        message: `${entry.permission} skills must require approval.`,
      });
    }

    if (entry.writesRecords && !entry.requiresApproval) {
      issues.push({
        skill: entry.name,
        code: 'RECORD_WRITE_REQUIRES_APPROVAL',
        message: 'Skills that write records must require approval.',
      });
    }

    if (entry.externalSideEffects && !entry.requiresApproval) {
      issues.push({
        skill: entry.name,
        code: 'EXTERNAL_SIDE_EFFECT_REQUIRES_APPROVAL',
        message: 'Skills with external side effects must require approval.',
      });
    }
  }

  return issues;
}

export function getLocalGuardrailHealth(osHome: string): GuardrailDecision {
  const probePath = path.join(osHome, 'artifacts', '.guardrail-probe');
  return assessLocalPathAccess({
    action: 'write',
    targetPath: probePath,
    osHome,
  });
}
