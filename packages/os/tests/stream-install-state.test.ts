import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;
let tempUserHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-stream-install-'));
  tempUserHome = mkdtempSync(join(tmpdir(), 'consuelo-stream-user-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
  rmSync(tempUserHome, { recursive: true, force: true });
});

function provision(): {
  actions: Array<{ type: string; path: string; status: string }>;
} {
  return JSON.parse(
    execFileSync(
      'bun',
      [
        '-e',
        `
          const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
          process.stdout.write(JSON.stringify(provisionLocalOs({ mode: 'local' })));
        `,
      ],
      {
        cwd: resolve(import.meta.dirname, '..'),
        env: {
          ...process.env,
          CONSUELO_HOME: tempHome,
          HOME: tempUserHome,
          CONSUELO_GRAPHQL_URL: '',
          CONSUELO_INTERNAL_GRAPHQL_API_KEY: '',
        },
        encoding: 'utf8',
      },
    ),
  );
}

describe('installed stream instructions', () => {
  it('seeds only the Tools stream instructions', () => {
    const result = provision();
    const toolsPath = join(tempHome, 'streams', 'tools', 'AGENTS.md');

    expect(existsSync(toolsPath)).toBe(true);
    expect(readFileSync(toolsPath, 'utf8')).toContain(
      '# Tools stream instructions',
    );
    expect(existsSync(join(tempHome, 'streams', 'docs'))).toBe(false);
    expect(existsSync(join(tempHome, 'streams', 'general'))).toBe(false);
    expect(existsSync(join(tempHome, 'streams', 'media'))).toBe(false);
    expect(result.actions).toContainEqual(
      expect.objectContaining({
        type: 'seed_stream',
        path: toolsPath,
        status: 'created',
      }),
    );
  });

  it('preserves user-authored Tools instructions on upgrade', () => {
    provision();
    const toolsPath = join(tempHome, 'streams', 'tools', 'AGENTS.md');
    writeFileSync(
      toolsPath,
      '# My exact tools instructions\n\nDo not replace this.\n',
    );

    const result = provision();

    expect(readFileSync(toolsPath, 'utf8')).toBe(
      '# My exact tools instructions\n\nDo not replace this.\n',
    );
    expect(result.actions).toContainEqual(
      expect.objectContaining({
        type: 'seed_stream',
        path: toolsPath,
        status: 'preserved',
      }),
    );
  });
});
