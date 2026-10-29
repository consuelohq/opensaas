export const publicBase = import.meta.env?.BASE_URL ?? '/';

export function withDocsBase(path: string, base?: string): string;
export function withDocsBase(path: string | URL | null | undefined, base?: string): string | undefined;
export function withDocsBase(path: string | URL | null | undefined, base = publicBase): string | undefined {
  if (path == null) return undefined;
  const value = String(path);
  const prefix = base.replace(/\/$/, '');
  if (!prefix || !value.startsWith('/') || value.startsWith('//')
    || value === prefix || value.startsWith(prefix + '/') || value.startsWith(prefix + '?') || value.startsWith(prefix + '#')) return value;
  return prefix + value;
}

export function stripDocsBase(path: string, base = publicBase): string {
  const prefix = base.replace(/\/$/, '');
  return prefix && (path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?') || path.startsWith(prefix + '#'))
    ? path.slice(prefix.length) || '/' : path;
}
