import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('raw operator steering', () => {
  it('preserves the bundled operator surface and canonical full manifest', () => {
    const result = spawnSync('bun', ['--eval', `
      const { getRawSteering } = await import('./scripts/os.ts');
      process.stdout.write(JSON.stringify({ steering: getRawSteering() }));
    `], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env },
    });
    if (result.status !== 0) {
      throw new Error(`getRawSteering failed:\n${result.stderr || result.stdout}`);
    }
    const steering = (JSON.parse(result.stdout) as { steering: string }).steering;

    expect(steering).toContain('# Consuelo OS raw/operator steering');
    expect(steering).toContain('# bundled OS system_prompt.md');
    expect(steering).toContain('# System Prompt');
    expect(steering).toContain('# canonical full tool manifest');
    expect(steering).toContain('"kind": "consuelo-os-tool-manifest"');
    expect(steering).not.toContain('# decision.md');
    expect(steering).not.toContain('# decision process');
  });
});
