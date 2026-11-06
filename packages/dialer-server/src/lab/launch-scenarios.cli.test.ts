import { expect, test } from 'bun:test';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dir, '../../../..');
const script = join(root, 'packages/dialer-server/scripts/launch-scenarios.ts');
const call = async (args: string[], dir: string) => {
  const proc = Bun.spawn([process.execPath, script, ...args], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, CONSUELO_LAUNCH_QA_EVIDENCE_DIR: dir },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
};

test('human scenario CLI can list and show actual operator steps', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dialer-qa-cli-'));
  try {
    const listed = await call(['list'], dir);
    expect(listed.exitCode).toBe(0);
    expect(listed.stdout).toContain('S01');
    expect(listed.stdout).toContain('S24');
    const shown = await call(['show', 'S05'], dir);
    expect(shown.exitCode).toBe(0);
    expect(shown.stdout).toContain('three-line');
    expect(shown.stdout).toContain('Expected');
    expect(shown.stdout).toContain('not proof of live call');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('dry-run never writes evidence or calls a carrier', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dialer-qa-cli-'));
  try {
    const dry = await call(['run', 'S01,S04', '--dry-run'], dir);
    expect(dry.exitCode).toBe(0);
    expect(dry.stdout).toContain('bun --no-env-file test');
    expect(dry.stdout).not.toContain('seed=');
    expect(await readdir(dir)).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('manual record sanitizes incident note and keeps machine-verification honest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dialer-qa-cli-'));
  try {
    const saved = await call(
      [
        'record',
        'S01',
        '--result',
        'failed',
        '--observer',
        'QA tester',
        '--note',
        'audio dropped to +17045550123; token=credential',
        '--trace-id',
        'trc_test_123',
      ],
      dir,
    );
    expect(saved.exitCode).toBe(0);
    const files = await readdir(dir);
    expect(files.length).toBe(1);
    const record = JSON.parse(await readFile(join(dir, files[0]!), 'utf8'));
    expect(record.outcome).toBe('failed');
    expect(record.lane).toBe('manual');
    expect(record.liveStatus).toBe('unverified');
    expect(JSON.stringify(record)).not.toContain('+17045550123');
    expect(JSON.stringify(record)).not.toContain('credential');
    const report = await call(['report'], dir);
    expect(report.exitCode).toBe(0);
    expect(report.stdout).toContain('failed');
    expect(report.stdout).toContain('Not yet executed');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('cannot fabricate a manual pass without a human observer', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dialer-qa-cli-'));
  try {
    const result = await call(
      ['record', 'S07', '--result', 'passed', '--note', 'looks good'],
      dir,
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('observer');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
