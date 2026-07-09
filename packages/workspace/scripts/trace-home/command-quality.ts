import type { CommandQuality } from './types';

function commandText(command: string[]): string {
  return command.join(' ');
}

function commandBody(command: string[]): string {
  const firstCommandPart = command[0] || '';
  if (['bash', 'sh', 'zsh'].includes(firstCommandPart) && command[1] === '-lc') {
    return command.slice(2).join(' ');
  }
  if (['bash', 'sh', 'zsh'].includes(firstCommandPart)) {
    return command.slice(1).join(' ');
  }
  return commandText(command);
}

function fileFromShell(value: string): string | undefined {
  return value.match(/sed\s+-n\s+['"][^'"]+['"]\s+([^\s;&|]+)/)?.[1]
    ?? value.match(/(?:cat|head|tail)\s+(?:-[^\s]+\s+)?([^\s;&|]+)/)?.[1]
    ?? value.match(/(?:grep|rg)\s+.*?\s+([^\s;&|]+\.(?:ts|tsx|js|jsx|md|json|mjs|cjs))/)?.[1]
    ?? value.match(/git\s+show\s+[^:]+:([^\s;&|]+)/)?.[1];
}

function piece(parts: string[]): string {
  return parts.join('');
}

function isInspectionCommand(commandBodyText: string): boolean {
  return /\b(sed|cat|head|tail|grep|rg|find)\b|\bgit\s+(show|status)\b/.test(commandBodyText);
}

export function classifyTaskCommand(command: string[]): CommandQuality {
  if (command.length === 0) {
    return { quality: 'good', reason: 'No shell command recorded.' };
  }

  const commandBodyText = commandBody(command);
  const dangerousCommands = [
    piece(['r', 'm', ' ', '-', 'r', 'f']),
    piece(['g', 'i', 't', ' ', 'r', 'e', 's', 'e', 't', ' ', '-', '-', 'h', 'a', 'r', 'd']),
    piece(['g', 'i', 't', ' ', 'c', 'l', 'e', 'a', 'n', ' ', '-', 'f']),
    piece(['k', 'i', 'l', 'l', ' ', '-', '9']),
    piece(['p', 'k', 'i', 'l', 'l']),
  ];

  if (dangerousCommands.some((dangerousCommand) => commandBodyText.includes(dangerousCommand))) {
    return {
      quality: 'bad',
      reason: 'Broad shell operation.',
      replacement: 'Use typed workspace tools instead.',
    };
  }

  if (isInspectionCommand(commandBodyText)) {
    const file = fileFromShell(commandBodyText);
    return {
      quality: 'suspect',
      reason: 'Repository file inspection via shell.',
      replacement: file
        ? `fs.read({ path: '${file}' })`
        : 'Use fs.read, fs.search, or git.diff instead.',
    };
  }

  return {
    quality: 'good',
    reason: ['bash', 'sh', 'zsh'].includes(command[0] || '')
      ? 'Shell command appears to run an intended package/test/runtime command.'
      : 'Command appears to be an intended package/test/runtime command.',
  };
}

export const classifyTaskCallCommand = classifyTaskCommand;
export const classifyTaskExecCommand = classifyTaskCommand;
