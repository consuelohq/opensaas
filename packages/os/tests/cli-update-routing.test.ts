import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import {
  buildOsUpdateInvocation,
  registerUpdate,
} from '../../cli/src/commands/update';

describe('top-level consuelo update routing', () => {
  it('delegates update flags to the installed OS lifecycle command', () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-cli-update-'));

    try {
      const commandPath = join(home, 'bin', 'consuelo');
      mkdirSync(join(home, 'bin'), { recursive: true });
      writeFileSync(commandPath, '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });

      expect(buildOsUpdateInvocation({
        channel: 'beta',
        check: true,
        yes: true,
        json: true,
        quiet: true,
      }, { home })).toEqual({
        command: commandPath,
        args: [
          'update',
          '--channel',
          'beta',
          '--check',
          '--yes',
          '--json',
          '--quiet',
        ],
        home,
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('fails with an install recovery command when the OS lifecycle command is missing', () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-cli-update-missing-'));

    try {
      expect(() => buildOsUpdateInvocation({}, { home })).toThrow(
        'Consuelo OS is not installed',
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('registers update as a top-level CLI command', () => {
    const program = new Command();
    registerUpdate(program);

    const update = program.commands.find((command) => command.name() === 'update');
    expect(update).toBeDefined();
    expect(update?.options.map((option) => option.long)).toEqual([
      '--channel',
      '--check',
      '--yes',
    ]);
  });
});
