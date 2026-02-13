/** Simple output helpers — plain stdout for CLI UX */

declare global {
  // eslint-disable-next-line no-var
  var __consuelo_quiet: boolean | undefined;
  // eslint-disable-next-line no-var
  var __consuelo_json: boolean | undefined;
  // eslint-disable-next-line no-var
  var __consuelo_cli_mode: boolean | undefined;
}

export function log(msg: string): void {
  if (!globalThis.__consuelo_quiet) process.stdout.write(`${msg}\n`);
}

export function error(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

export function json(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function isJson(): boolean {
  return !!globalThis.__consuelo_json;
}
