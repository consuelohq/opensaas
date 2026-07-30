import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * `packages/workspace/STEERING.md` is the canonical steering document. The copy bundled into the OS
 * runtime is what actually reaches agents.
 *
 * These drifted by 213 lines without anyone noticing, and the bundled copy was the older revision.
 * The consequence was that Alignment First, the Steering Compression Rule, and Reuse Before
 * Invention — the governance rules — reached no agent at all, while everyone assumed they did.
 * Silent divergence between "the doctrine" and "what agents receive" is the failure mode worth a
 * test.
 */

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const CANONICAL = path.resolve(
  PACKAGE_ROOT,
  '..',
  'workspace',
  'STEERING.md',
);
const BUNDLED = path.join(PACKAGE_ROOT, 'steering', 'system_prompt.md');

describe('steering canonical source', () => {
  it('bundles the canonical workspace steering verbatim', () => {
    expect(fs.existsSync(CANONICAL)).toBe(true);
    expect(fs.existsSync(BUNDLED)).toBe(true);
    expect(fs.readFileSync(BUNDLED, 'utf8')).toBe(
      fs.readFileSync(CANONICAL, 'utf8'),
    );
  });

  it('carries the governance rules that must reach every agent', () => {
    const bundled = fs.readFileSync(BUNDLED, 'utf8');
    for (const rule of [
      'Alignment First',
      'Steering Compression Rule',
      'Reuse Before Invention',
      'read-only mode',
    ]) {
      expect(bundled).toContain(rule);
    }
  });

  it('carries no credential-shaped material, since it ships to every user', () => {
    const bundled = fs.readFileSync(BUNDLED, 'utf8');
    for (const pattern of [
      /\bsk-[A-Za-z0-9]{16,}/,
      /\bghp_[A-Za-z0-9]{16,}/,
      /\bAKIA[0-9A-Z]{16}\b/,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    ]) {
      expect(bundled).not.toMatch(pattern);
    }
  });
});
