import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createLifecycleEngine } from '../scripts/lib/lifecycle/engine';

function engineFor(home: string, revokeCurrentNode: () => Promise<'revoked' | 'not-enrolled'>) {
  const events: string[] = [];
  const engine = createLifecycleEngine({
    home,
    releaseSource: {
      async fetchManifest() {
        throw new Error('not used');
      },
      async fetchBundle() {
        throw new Error('not used');
      },
    },
    trustedReleaseKeys: {},
    service: {
      async preflight() {},
      async restart() {},
      async uninstall(options) {
        events.push(options?.dryRun ? 'service:dry-run' : 'service:uninstall');
      },
    },
    health: { async accept() { return true; } },
    nodeRegistration: {
      async revokeCurrentNode() {
        events.push('node:revoke');
        return revokeCurrentNode();
      },
    },
  });
  return { engine, events };
}

describe('lifecycle destructive node removal', () => {
  it('revokes the authority node before deleting local node identity', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-node-revoke-'));
    mkdirSync(join(home, 'node', 'security', 'generated'), { recursive: true });
    writeFileSync(join(home, 'node', 'security', 'generated', 'identity.txt'), 'identity\n');
    const revoke = vi.fn(async () => {
      expect(existsSync(join(home, 'node', 'security', 'generated', 'identity.txt'))).toBe(true);
      return 'revoked' as const;
    });
    const { engine, events } = engineFor(home, revoke);

    await engine.uninstall({ removeNode: true });

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(events.slice(0, 2)).toEqual(['node:revoke', 'service:uninstall']);
    expect(existsSync(join(home, 'node'))).toBe(false);
  });

  it('does not contact the authority for a normal uninstall or dry-run', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-node-revoke-'));
    mkdirSync(join(home, 'node'), { recursive: true });
    const revoke = vi.fn(async () => 'revoked' as const);
    const { engine } = engineFor(home, revoke);

    await engine.uninstall();
    expect(revoke).not.toHaveBeenCalled();

    mkdirSync(join(home, 'node'), { recursive: true });
    await engine.uninstall({ removeNode: true, dryRun: true });
    expect(revoke).not.toHaveBeenCalled();
  });

  it('preserves local node identity when authority revocation fails', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-node-revoke-'));
    mkdirSync(join(home, 'node', 'security', 'generated'), { recursive: true });
    const identity = join(home, 'node', 'security', 'generated', 'identity.txt');
    writeFileSync(identity, 'identity\n');
    const { engine, events } = engineFor(home, async () => {
      throw new Error('authority unavailable');
    });

    await expect(engine.uninstall({ removeNode: true })).rejects.toThrow(
      /authority unavailable|uninstall failed/i,
    );
    expect(events).toEqual(['node:revoke']);
    expect(existsSync(identity)).toBe(true);
  });
});
