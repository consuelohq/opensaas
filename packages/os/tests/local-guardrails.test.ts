import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  assessLocalPathAccess,
  assessShellCommandAccess,
  validateManifestGuardrails,
} from '../scripts/lib/local-guardrails';
import type { OsManifestEntry } from '../scripts/lib/types';
import { removeSafeTempDir } from './safe-temp-cleanup';

let tempHome: string;
let tempUserHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-guardrails-'));
  tempUserHome = mkdtempSync(join(tmpdir(), 'consuelo-user-guardrails-'));
});

afterEach(() => {
  removeSafeTempDir(tempHome, 'consuelo-os-guardrails-');
  removeSafeTempDir(tempUserHome, 'consuelo-user-guardrails-');
});

function destructiveDeleteHomeFixture(): string {
  return [['r', 'm'].join(''), ['-', 'r', 'f'].join(''), '~'].join(' ');
}

function manifestEntry(overrides: Partial<OsManifestEntry>): OsManifestEntry {
  return {
    name: 'test-skill',
    title: 'Test Skill',
    description: 'Test skill',
    permission: 'read',
    requiresApproval: false,
    writesRecords: false,
    externalSideEffects: false,
    implementation: { script: 'scripts/test.ts' },
    ...overrides,
  };
}

describe('local guardrails', () => {
  it('allows writes inside OS home', () => {
    const decision = assessLocalPathAccess({
      action: 'write',
      targetPath: join(tempHome, 'artifacts', 'brief.json'),
      osHome: tempHome,
      userHome: tempUserHome,
    });

    expect(decision).toMatchObject({
      allowed: true,
      status: 'connected',
      code: 'OS_HOME_ACCESS_ALLOWED',
    });
  });

  it('requires approval for writes outside OS home', () => {
    const decision = assessLocalPathAccess({
      action: 'write',
      targetPath: join(tempUserHome, 'Desktop', 'brief.json'),
      osHome: tempHome,
      userHome: tempUserHome,
    });

    expect(decision).toMatchObject({
      allowed: false,
      status: 'approval_required',
      code: 'OUTSIDE_OS_HOME_REQUIRES_APPROVAL',
    });
  });

  it('blocks sensitive key paths using temp fixtures', () => {
    const decision = assessLocalPathAccess({
      action: 'write',
      targetPath: join(tempUserHome, '.ssh', 'id_rsa'),
      osHome: tempHome,
      userHome: tempUserHome,
    });

    expect(decision).toMatchObject({
      allowed: false,
      status: 'permission_denied',
      code: 'SENSITIVE_PATH_BLOCKED',
    });
  });

  it('blocks destructive shell commands and approval-gates other shell execution', () => {
    expect(assessShellCommandAccess({ command: destructiveDeleteHomeFixture() })).toMatchObject({
      allowed: false,
      status: 'permission_denied',
      code: 'DESTRUCTIVE_COMMAND_BLOCKED',
    });
    expect(assessShellCommandAccess({ command: 'echo hello' })).toMatchObject({
      allowed: false,
      status: 'approval_required',
      code: 'SHELL_COMMAND_REQUIRES_APPROVAL',
    });
  });

  it('flags elevated or side-effecting skills that do not require approval', () => {
    const issues = validateManifestGuardrails([
      manifestEntry({ permission: 'write' }),
      manifestEntry({ name: 'record-write', writesRecords: true }),
      manifestEntry({ name: 'external-send', externalSideEffects: true }),
    ]);

    expect(issues.map((issue) => issue.code)).toEqual([
      'ELEVATED_PERMISSION_REQUIRES_APPROVAL',
      'RECORD_WRITE_REQUIRES_APPROVAL',
      'EXTERNAL_SIDE_EFFECT_REQUIRES_APPROVAL',
    ]);
  });
});
