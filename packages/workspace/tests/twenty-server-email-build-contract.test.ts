import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('twenty-server email template build contract', () => {
  it('configures SWC to parse and transform the TSX templates exported by the server barrel', () => {
    const swcrcPath = resolve(import.meta.dirname, '../../twenty-server/.swcrc');
    const nestConfigPath = resolve(import.meta.dirname, '../../twenty-server/nest-cli.json');
    const swcrc = JSON.parse(readFileSync(swcrcPath, 'utf8')) as {
      jsc?: {
        parser?: { syntax?: string; tsx?: boolean };
        transform?: { react?: { runtime?: string } };
      };
    };
    const nestConfig = JSON.parse(readFileSync(nestConfigPath, 'utf8')) as {
      compilerOptions?: {
        builder?: string | {
          type?: string;
          options?: { extensions?: string[] };
        };
      };
    };

    expect(swcrc.jsc?.parser).toMatchObject({
      syntax: 'typescript',
      tsx: true,
    });
    expect(swcrc.jsc?.transform?.react?.runtime).toBe('automatic');
    expect(nestConfig.compilerOptions?.builder).toMatchObject({
      type: 'swc',
      options: {
        extensions: ['.js', '.ts', '.tsx'],
      },
    });
  });
});
