import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DIALER_STEERING_FILE_NAME,
  reconcileVisibleDialerSteering,
} from '../scripts/lib/visible-dialer-steering';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('visible dialer steering', () => {
  it('installs and updates system-owned dialer context under visible Consuelo', () => {
    const userRoot = mkdtempSync(join(tmpdir(), 'consuelo-visible-dialer-'));
    roots.push(userRoot);

    const created = reconcileVisibleDialerSteering({ userRoot, dryRun: false });
    const target = join(userRoot, 'Steering', DIALER_STEERING_FILE_NAME);
    expect(created).toMatchObject({ status: 'created', path: target });
    expect(readFileSync(target, 'utf8')).toContain(
      '# Consuelo Dialer agent instructions',
    );
    expect(target).not.toContain('.consuelo');

    writeFileSync(target, '# stale dialer context\n');
    const updated = reconcileVisibleDialerSteering({ userRoot, dryRun: false });
    expect(updated.status).toBe('updated');
    expect(readFileSync(target, 'utf8')).toContain(
      'Pipeline stage = predictive queue',
    );
  });

  it('rejects hidden runtime roots even when .consuelo is a parent segment', () => {
    const root = mkdtempSync(join(tmpdir(), 'consuelo-visible-hidden-'));
    roots.push(root);

    expect(() =>
      reconcileVisibleDialerSteering({
        userRoot: join(root, '.consuelo', 'Consuelo'),
        dryRun: false,
      }),
    ).toThrow('visible Consuelo folder');
  });

  it('reports a planned visible write without mutating disk during dry run', () => {
    const userRoot = mkdtempSync(
      join(tmpdir(), 'consuelo-visible-dialer-dry-'),
    );
    roots.push(userRoot);

    const action = reconcileVisibleDialerSteering({ userRoot, dryRun: true });
    expect(action.status).toBe('planned');
    expect(() => readFileSync(action.path, 'utf8')).toThrow();
  });
});
