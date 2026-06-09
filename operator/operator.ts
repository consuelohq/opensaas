#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OPERATOR_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(OPERATOR_ROOT, 'prompts');

type Command = 'list' | 'print' | 'run' | 'help';

function usage(): string {
  return [
    'usage: bun operator <list|print|run> [prompt]',
    '',
    'Commands:',
    '  list            list available operator prompts',
    '  print <prompt>  print a prompt body',
    '  run <prompt>    print an executable agent handoff for a prompt',
    '',
    'Examples:',
    '  bun operator list',
    '  bun operator print review',
    '  bun operator run review',
  ].join('\n');
}

function listPrompts(): string[] {
  if (!fs.existsSync(PROMPTS_DIR)) return [];
  return fs
    .readdirSync(PROMPTS_DIR)
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => entry.replace(/\.md$/, ''))
    .sort();
}

function resolvePromptPath(name: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error(`invalid prompt name: ${name}`);
  }
  const promptPath = path.join(PROMPTS_DIR, `${name}.md`);
  if (!fs.existsSync(promptPath)) {
    const available = listPrompts();
    throw new Error(
      available.length > 0
        ? `unknown prompt: ${name}. available: ${available.join(', ')}`
        : `unknown prompt: ${name}. no prompts are installed`,
    );
  }
  return promptPath;
}

function readPrompt(name: string): string {
  return fs.readFileSync(resolvePromptPath(name), 'utf8').trimEnd();
}

function main(argv: string[]): void {
  const command = (argv[0] ?? 'help') as Command;

  if (command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (command === 'list') {
    process.stdout.write(`${listPrompts().join('\n')}\n`);
    return;
  }

  if (command !== 'print' && command !== 'run') {
    throw new Error(`unknown command: ${command}`);
  }

  const promptName = argv[1];
  if (!promptName) throw new Error(`${command} requires a prompt name`);

  const prompt = readPrompt(promptName);
  if (command === 'print') {
    process.stdout.write(`${prompt}\n`);
    return;
  }

  process.stdout.write(
    [
      `Run the \`${promptName}\` operator prompt now. Treat the prompt below as the complete operator handoff.`,
      '',
      '---',
      '',
      prompt,
      '',
    ].join('\n'),
  );
}

try {
  main(Bun.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.stderr.write(`${usage()}\n`);
  process.exit(1);
}
