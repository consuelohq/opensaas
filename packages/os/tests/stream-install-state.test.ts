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

describe('installed visible user tree', () => {
  it('does not seed a hidden mutable stream mirror', () => {
    const result = provision();
    const toolsPath = join(tempHome, 'streams', 'tools', 'AGENTS.md');

    expect(existsSync(toolsPath)).toBe(false);
    expect(existsSync(join(tempHome, 'streams'))).toBe(false);
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Steering'))).toBe(true);
    expect(result.actions.some((action) => action.type === 'seed_stream')).toBe(
      false,
    );
  });

  it('preserves user-authored visible Steering content on upgrade', () => {
    provision();
    const steeringInstructionsPath = join(
      tempUserHome,
      'Consuelo',
      'Steering',
      'AGENTS.md',
    );
    writeFileSync(
      steeringInstructionsPath,
      '# My exact tools instructions\n\nDo not replace this.\n',
    );

    const result = provision();

    expect(readFileSync(steeringInstructionsPath, 'utf8')).toBe(
      '# My exact tools instructions\n\nDo not replace this.\n',
    );
    expect(
      result.actions.some(
        (action) =>
          action.path === join(tempUserHome, 'Consuelo', 'Steering') &&
          action.status === 'preserved',
      ),
    ).toBe(true);
  });
});
