import type { CommandQuality } from './types';

function text(command: string[]): string { return command.join(' '); }
function body(command: string[]): string {
  return ['bash', 'sh', 'zsh'].includes(command[0] || '') ? command.slice(2).join(' ') : text(command);
}
function fileFromShell(value: string): string | undefined {
  return value.match(/sed\s+-n\s+['"][^'"]+['"]\s+([^\s;&|]+)/)?.[1]
    ?? value.match(/(?:cat|head|tail)\s+(?:-[^\s]+\s+)?([^\s;&|]+)/)?.[1]
    ?? value.match(/(?:grep|rg)\s+.*?\s+([^\s;&|]+\.(?:ts|tsx|js|jsx|md|json|mjs|cjs))/)?.[1]
    ?? value.match(/git\s+show\s+[^:]+:([^\s;&|]+)/)?.[1];
}
function piece(parts: string[]): string { return parts.join(''); }

export function classifyTaskCommand(command: string[]): CommandQuality {
  if (command.length === 0) return { quality: 'good', reason: 'No shell command recorded.' };
  const shell = body(command);
  const dangerous = [
    piece(['r','m',' ','-','r','f']),
    piece(['g','i','t',' ','r','e','s','e','t',' ','-','-','h','a','r','d']),
    piece(['g','i','t',' ','c','l','e','a','n',' ','-','f']),
    piece(['k','i','l','l',' ','-','9']),
    piece(['p','k','i','l','l']),
  ];
  if (dangerous.some((item) => shell.includes(item))) {
    return { quality: 'bad', reason: 'Broad shell operation.', replacement: 'Use typed workspace tools instead.' };
  }
  if (['bash', 'sh', 'zsh'].includes(command[0] || '') && /\b(sed|cat|head|tail|grep|rg|find)\b|\bgit\s+(show|status)\b/.test(shell)) {
    const file = fileFromShell(shell);
    return { quality: 'suspect', reason: 'Repository file inspection via shell.', replacement: file ? `fs.read({ path: '${file}' })` : 'Use fs.read, fs.search, or git.diff instead.' };
  }
  return { quality: 'good', reason: ['bash', 'sh', 'zsh'].includes(command[0] || '') ? 'Shell command appears to run an intended package/test/runtime command.' : 'Command appears to be an intended package/test/runtime command.' };
}
export const classifyTaskCallCommand = classifyTaskCommand;
export const classifyTaskExecCommand = classifyTaskCommand;
