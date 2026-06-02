import { readFile as fsRead, writeFile as fsWrite, appendFile as fsAppend, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

export async function readFile(
  basePath: string, path: string, startLine?: number, endLine?: number,
): Promise<string | { error: string }> {
  try {
    const content = await fsRead(resolve(basePath, path), 'utf-8');
    if (startLine === undefined) return content;
    const lines = content.split('\n');
    return lines.slice((startLine ?? 1) - 1, endLine ?? lines.length).join('\n');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'ENOENT') return { error: `File not found: ${path}` };
      if (code === 'EACCES') return { error: `Permission denied: ${path}` };
    }
    throw err;
  }
}

export async function writeFile(
  basePath: string, path: string, content: string,
): Promise<{ written: number }> {
  await fsWrite(resolve(basePath, path), content, 'utf-8');
  return { written: content.length };
}

export async function editFile(
  basePath: string, path: string, oldStr: string, newStr: string,
): Promise<{ replaced: boolean; error?: string }> {
  const fullPath = resolve(basePath, path);
  let content: string;
  try {
    content = await fsRead(fullPath, 'utf-8');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'ENOENT') return { replaced: false, error: `File not found: ${path}` };
      if (code === 'EACCES') return { replaced: false, error: `Permission denied: ${path}` };
    }
    throw err;
  }
  if (!content.includes(oldStr)) return { replaced: false };
  const count = content.split(oldStr).length - 1;
  if (count > 1) return { replaced: false, error: `"${oldStr.slice(0, 50)}..." matches ${count} times. Must be unique.` };
  await fsWrite(fullPath, content.replace(oldStr, newStr), 'utf-8');
  return { replaced: true };
}

export async function appendFile(
  basePath: string, path: string, content: string,
): Promise<{ appended: number }> {
  await fsAppend(resolve(basePath, path), content, 'utf-8');
  return { appended: content.length };
}

export async function insertLine(
  basePath: string, path: string, afterLine: number, content: string,
): Promise<{ inserted: boolean; error?: string }> {
  const fullPath = resolve(basePath, path);
  let existing: string;
  try {
    existing = await fsRead(fullPath, 'utf-8');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'ENOENT') return { inserted: false, error: `File not found: ${path}` };
      if (code === 'EACCES') return { inserted: false, error: `Permission denied: ${path}` };
    }
    throw err;
  }
  const lines = existing.split('\n');
  if (afterLine < 0 || afterLine > lines.length) {
    return { inserted: false, error: `Line ${afterLine} out of range (file has ${lines.length} lines)` };
  }
  lines.splice(afterLine, 0, content);
  await fsWrite(fullPath, lines.join('\n'), 'utf-8');
  return { inserted: true };
}

export async function readDir(
  basePath: string, path: string, depth?: number,
): Promise<string[]> {
  try {
    const fullPath = resolve(basePath, path);
    const entries = await readdir(fullPath, { withFileTypes: true, recursive: depth !== 0 });
    return entries.map(e => {
      const rel = relative(fullPath, resolve(e.parentPath ?? fullPath, e.name));
      return e.isDirectory() ? `${rel}/` : rel;
    });
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}
