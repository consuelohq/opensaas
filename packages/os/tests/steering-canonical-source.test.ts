import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  steeringExampleTemplate,
  userSystemPromptTemplate,
} from '../scripts/lib/managed-user-content';

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const LEGACY_WORKSPACE_STEERING = path.resolve(
  PACKAGE_ROOT,
  '..',
  'workspace',
  'STEERING.md',
);
const LEGACY_BUNDLED_STEERING = path.join(
  PACKAGE_ROOT,
  'steering',
  'system_prompt.md',
);

describe('steering canonical source', () => {
  it('keeps user steering out of the repository source tree', () => {
    expect(fs.existsSync(LEGACY_WORKSPACE_STEERING)).toBe(false);
    expect(fs.existsSync(LEGACY_BUNDLED_STEERING)).toBe(false);
  });

  it('ships generic starter content rather than a private system prompt', () => {
    const starter = userSystemPromptTemplate();
    const example = steeringExampleTemplate();

    expect(starter).toContain('system.md');
    expect(starter).toContain('primary steering');
    expect(starter).toContain('next steering read');
    expect(example).toContain('NOT loaded');
    expect(starter.length).toBeLessThan(2_000);
    expect(example.length).toBeLessThan(2_000);
    expect(starter).not.toContain('packages/workspace/');
    expect(example).not.toContain('packages/workspace/');
  });
});
