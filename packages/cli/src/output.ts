/** Simple output helpers — plain stdout for CLI UX */

declare global {
  // eslint-disable-next-line no-var
  var __consuelo_quiet: boolean | undefined;
  // eslint-disable-next-line no-var
  var __consuelo_json: boolean | undefined;
  // eslint-disable-next-line no-var
  var __consuelo_cli_mode: boolean | undefined;
}

export const log = (msg: string): void => {
  if (!globalThis.__consuelo_quiet) process.stdout.write(`${msg}\n`);
};

export const error = (msg: string): void => {
  if (!globalThis.__consuelo_quiet) process.stderr.write(`${msg}\n`);
};

export const json = (data: unknown): void => {
  if (!globalThis.__consuelo_quiet) process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};

export const isJson = (): boolean => !!globalThis.__consuelo_json;
