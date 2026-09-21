import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { toolHandlers } from '../tools/google/handler';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('bundled Google skill', () => {
  it('is a default active guidance skill named google', () => {
    const metadata = JSON.parse(fs.readFileSync(path.join(packageRoot, 'skills/google/skill.json'), 'utf8')) as Record<string, unknown>;
    expect(metadata).toMatchObject({
      name: 'google',
      title: 'Google',
      status: 'active',
      permission: 'guidance',
      requiresApproval: false,
      tools: ['os.get_steering', 'os.call'],
    });
    expect(String(metadata.description)).toMatch(/Gmail.*Calendar.*Drive.*Docs.*Sheets.*Contacts/i);
  });

  it('executes the package-owned Google command from the installed runtime', () => {
    expect(toolHandlers[0]?.command.executionScope).toBe('runtime');
  });

  it('teaches the OS-native google tool rather than OpenClaw installation commands', () => {
    const body = fs.readFileSync(path.join(packageRoot, 'skills/google/SKILL.md'), 'utf8');
    expect(body).toMatch(/tool[^\n]*`google`/i);
    expect(body).toMatch(/first use|connect|oauth/i);
    expect(body).not.toContain('openclaw skill add');
  });
});
