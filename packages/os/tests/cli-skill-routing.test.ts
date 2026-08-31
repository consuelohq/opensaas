import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import {
  buildOsSkillInvocation,
  registerSkillCommands,
} from '../../cli/src/commands/skills';

describe('top-level consuelo skill routing', () => {
  it('delegates add/remove skill commands to the installed OS lifecycle command', () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-cli-skills-'));

    try {
      const commandPath = join(home, 'bin', 'consuelo');
      mkdirSync(join(home, 'bin'), { recursive: true });
      writeFileSync(commandPath, '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });

      expect(buildOsSkillInvocation('add', ['branch'], { json: true }, { home })).toEqual({
        command: commandPath,
        args: ['add', 'skill', 'branch', '--json'],
        home,
      });
      expect(buildOsSkillInvocation('remove', [], { quiet: true }, { home })).toEqual({
        command: commandPath,
        args: ['remove', 'skill', '--quiet'],
        home,
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('registers add skill and remove skill as top-level command paths', () => {
    const program = new Command();
    registerSkillCommands(program);

    const add = program.commands.find((command) => command.name() === 'add');
    const remove = program.commands.find((command) => command.name() === 'remove');

    expect(add?.commands.map((command) => command.name())).toContain('skill');
    expect(remove?.commands.map((command) => command.name())).toContain('skill');
  });
});
