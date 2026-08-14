import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

export type CloudflareRunnerIo = {
  stdin: string;
  stdout: (value: string) => void;
  stderr: (value: string) => void;
};

type ParsedArguments = {
  command: string;
  flags: Map<string, string>;
};

type TailEntry = Record<string, unknown>;

const parseArguments = (argv: string[]): ParsedArguments => {
  const [command = '', ...tokens] = argv;
  const flags = new Map<string, string>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${token}`);
    flags.set(token.slice(2), value);
    index += 1;
  }
  return { command, flags };
};

const requiredFlag = (parsed: ParsedArguments, name: string): string => {
  const value = parsed.flags.get(name)?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
};

const optionalFlag = (parsed: ParsedArguments, name: string): string | undefined => {
  const value = parsed.flags.get(name)?.trim();
  return value || undefined;
};

const positiveIntegerFlag = (
  parsed: ParsedArguments,
  name: string,
  fallback: number,
  maximum: number,
): number => {
  const raw = optionalFlag(parsed, name);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return Math.min(value, maximum);
};

const writeJson = (io: CloudflareRunnerIo, value: unknown): void => {
  io.stdout(`${JSON.stringify(value)}\n`);
};

const redactKnownValue = (value: string, secret: string): string => {
  if (!secret) return value;
  return value.replaceAll(secret, '[REDACTED_SECRET]');
};

const spawnWrangler = (
  command: string,
  args: string[],
  stdin?: string,
): ChildProcessWithoutNullStreams => {
  const child = spawn(command, args, {
    env: process.env,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (stdin === undefined) child.stdin.end();
  else child.stdin.end(stdin.endsWith('\n') ? stdin : `${stdin}\n`);
  return child;
};

const waitForExit = (child: ChildProcessWithoutNullStreams): Promise<number> => new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => resolve(code ?? 1));
});

const streamText = async (stream: NodeJS.ReadableStream): Promise<string> => {
  try {
    let output = '';
    for await (const chunk of stream) output += String(chunk);
    return output;
  } catch (error: unknown) {
    throw new Error('failed to read Wrangler process output', { cause: error });
  }
};

const tailArgs = (parsed: ParsedArguments): string[] => {
  const kind = requiredFlag(parsed, 'kind');
  const target = requiredFlag(parsed, 'target');
  const deploymentId = optionalFlag(parsed, 'deployment-id');
  const environment = optionalFlag(parsed, 'environment');

  if (kind === 'worker') {
    return [
      'tail',
      target,
      '--format',
      'json',
      ...(deploymentId ? ['--version-id', deploymentId] : []),
    ];
  }
  if (kind === 'pages') {
    return [
      'pages',
      'deployment',
      'tail',
      ...(deploymentId ? [deploymentId] : []),
      '--project-name',
      target,
      ...(environment ? ['--environment', environment] : []),
      '--format',
      'json',
    ];
  }
  throw new Error(`unsupported Cloudflare target kind: ${kind}`);
};

const collectTail = async (
  child: ChildProcessWithoutNullStreams,
  limit: number,
  durationMs: number,
): Promise<{ entries: TailEntry[]; stderr: string; exitCode: number }> => {
  const entries: TailEntry[] = [];
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  const exit = waitForExit(child);
  let durationElapsed = false;
  const timer = setTimeout(() => {
    durationElapsed = true;
    child.kill();
  }, durationMs);
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });

  try {
    for await (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const value = JSON.parse(trimmed) as unknown;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          entries.push(value as TailEntry);
        }
      } catch {
        // Wrangler can emit non-JSON startup notices before JSON tail events.
      }
      if (entries.length >= limit) {
        child.kill();
        lines.close();
        break;
      }
    }
  } finally {
    clearTimeout(timer);
    lines.close();
  }

  const exitCode = await exit;
  if (entries.length > 0 || durationElapsed) return { entries, stderr, exitCode: 0 };
  return { entries, stderr, exitCode };
};

const runTail = async (parsed: ParsedArguments, io: CloudflareRunnerIo): Promise<number> => {
  let child: ChildProcessWithoutNullStreams | undefined;
  try {
    const executable = requiredFlag(parsed, 'wrangler');
    const limit = positiveIntegerFlag(parsed, 'limit', 100, 500);
    const durationMs = positiveIntegerFlag(parsed, 'duration-ms', 10_000, 120_000);
    child = spawnWrangler(executable, tailArgs(parsed));
    const result = await collectTail(child, limit, durationMs);
    if (result.exitCode !== 0 && result.entries.length === 0) {
      io.stderr(result.stderr);
      return result.exitCode || 1;
    }
    writeJson(io, result.entries);
    return 0;
  } catch (error: unknown) {
    child?.kill();
    throw new Error('failed to collect Wrangler tail events', { cause: error });
  }
};

const secretPutArgs = (parsed: ParsedArguments): { args: string[]; scope: string } => {
  const kind = requiredFlag(parsed, 'kind');
  const target = requiredFlag(parsed, 'target');
  const name = requiredFlag(parsed, 'name');
  const environment = optionalFlag(parsed, 'environment');

  if (kind === 'worker') {
    return {
      args: [
        'secret',
        'put',
        name,
        '--name',
        target,
        ...(environment ? ['--env', environment] : []),
      ],
      scope: `worker:${target}${environment ? `:${environment}` : ''}`,
    };
  }
  if (kind === 'pages') {
    if (environment) throw new Error('Pages secrets do not accept an environment selector');
    return {
      args: ['pages', 'secret', 'put', name, '--project-name', target],
      scope: `pages:${target}`,
    };
  }
  throw new Error(`unsupported Cloudflare target kind: ${kind}`);
};

const runSecretPut = async (parsed: ParsedArguments, io: CloudflareRunnerIo): Promise<number> => {
  let child: ChildProcessWithoutNullStreams | undefined;
  try {
    const executable = requiredFlag(parsed, 'wrangler');
    const name = requiredFlag(parsed, 'name');
    const secret = io.stdin;
    const command = secretPutArgs(parsed);
    child = spawnWrangler(executable, command.args, secret);
    const [stdout, stderr, exitCode] = await Promise.all([
      streamText(child.stdout),
      streamText(child.stderr),
      waitForExit(child),
    ]);
    if (exitCode !== 0) {
      io.stderr(redactKnownValue(`${stderr}\n${stdout}`.trim(), secret));
      return exitCode || 1;
    }
    writeJson(io, { name, scopes: [command.scope], updated: true });
    return 0;
  } catch (error: unknown) {
    child?.kill();
    throw new Error('failed to update Wrangler secret', { cause: error });
  }
};

const readDefaultStdin = async (): Promise<string> => {
  let input = '';
  for await (const chunk of process.stdin) input += String(chunk);
  return input;
};

const defaultIo = async (): Promise<CloudflareRunnerIo> => ({
  stdin: await readDefaultStdin(),
  stdout: (value) => process.stdout.write(value),
  stderr: (value) => process.stderr.write(value),
});

export const runCloudflareRunner = async (
  argv: string[],
  io?: CloudflareRunnerIo,
): Promise<number> => {
  try {
    const parsed = parseArguments(argv);
    const resolvedIo = io || await defaultIo();
    if (parsed.command === 'tail') return await runTail(parsed, resolvedIo);
    if (parsed.command === 'secret-put') return await runSecretPut(parsed, resolvedIo);
    resolvedIo.stderr(`unsupported Cloudflare runner command: ${parsed.command}\n`);
    return 2;
  } catch (error: unknown) {
    const resolvedIo = io || {
      stdin: '',
      stdout: (value: string) => process.stdout.write(value),
      stderr: (value: string) => process.stderr.write(value),
    };
    const message = error instanceof Error ? error.message : String(error);
    resolvedIo.stderr(`${message}\n`);
    return 2;
  }
};

if (import.meta.main) {
  process.exitCode = await runCloudflareRunner(process.argv.slice(2));
}
