import type {
  SandboxResult,
  SandboxArtifact,
  SandboxExecuteOptions,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_TEMPLATE = 'consuelo-agent';
const OUTPUT_DIR = '/output';
const DATA_DIR = '/data';
const SANDBOX_TTL_MS = 5 * 60 * 1000; // 5 min idle before cleanup

type PoolEntry = {
  sandbox: Awaited<ReturnType<typeof createSandbox>>;
  userId: string;
  lastUsed: number;
};

// lazy sandbox creation helper for type inference
const createSandbox = async (template: string, envs: Record<string, string>, timeoutMs: number) => {
  const { Sandbox } = await import('e2b');
  return Sandbox.create(template, { envs, timeoutMs });
};

export class SandboxService {
  private template: string;
  private pool: Map<string, PoolEntry> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(template = DEFAULT_TEMPLATE) {
    this.template = template;
  }

  async execute(options: SandboxExecuteOptions & { userId?: string }): Promise<SandboxResult> {
    const sandbox = options.userId
      ? await this.getOrCreate(options.userId, options.envVars ?? {}, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
      : await createSandbox(this.template, options.envVars ?? {}, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      // inject context data into sandbox filesystem
      if (options.contextData) {
        await sandbox.files.write(
          `${DATA_DIR}/context.json`,
          JSON.stringify(options.contextData),
        );
      }

      // build execution command
      const command =
        options.language === 'python'
          ? `python3 -c ${shellEscape(options.code)}`
          : `node -e ${shellEscape(options.code)}`;

      const process = await sandbox.commands.run(command, {
        onStdout: options.onStdout,
        onStderr: options.onStderr,
      });

      const artifacts = await this.collectArtifacts(sandbox);

      // update last used time for pooled sandboxes
      if (options.userId) {
        const entry = this.pool.get(options.userId);
        if (entry) entry.lastUsed = Date.now();
      }

      return {
        stdout: process.stdout,
        stderr: process.stderr,
        exitCode: process.exitCode,
        artifacts,
      };
    } catch (err: unknown) {
      // on error, evict from pool and kill
      if (options.userId) {
        this.pool.delete(options.userId);
      }
      await sandbox.kill();
      throw err;
    } finally {
      // kill non-pooled sandboxes immediately
      if (!options.userId) {
        await sandbox.kill();
      }
    }
  }

  private async getOrCreate(
    userId: string,
    envs: Record<string, string>,
    timeoutMs: number,
  ) {
    const existing = this.pool.get(userId);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.sandbox;
    }

    const sandbox = await createSandbox(this.template, envs, timeoutMs);
    this.pool.set(userId, { sandbox, userId, lastUsed: Date.now() });
    this.startCleanup();
    return sandbox;
  }

  private startCleanup() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [userId, entry] of this.pool) {
        if (now - entry.lastUsed > SANDBOX_TTL_MS) {
          entry.sandbox.kill().catch(() => {});
          this.pool.delete(userId);
        }
      }
      if (this.pool.size === 0 && this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
    }, 60_000);
  }

  async shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const [, entry] of this.pool) {
      await entry.sandbox.kill().catch(() => {});
    }
    this.pool.clear();
  }

  private async collectArtifacts(
    sandbox: Awaited<ReturnType<typeof createSandbox>>,
  ): Promise<SandboxArtifact[]> {
    try {
      const entries = await sandbox.files.list(OUTPUT_DIR);
      const artifacts: SandboxArtifact[] = [];

      for (const entry of entries) {
        if (entry.type === 'file') {
          const data = await sandbox.files.read(`${OUTPUT_DIR}/${entry.name}`, {
            format: 'bytes',
          });
          artifacts.push({
            path: entry.name,
            mimeType: guessMimeType(entry.name),
            data: Buffer.from(data),
          });
        }
      }

      return artifacts;
    } catch {
      // output dir may not exist if no files were generated
      return [];
    }
  }
}

const shellEscape = (code: string): string =>
  "'" + code.replace(/'/g, "'\\''") + "'";

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  csv: 'text/csv',
  json: 'application/json',
  html: 'text/html',
  pdf: 'application/pdf',
  txt: 'text/plain',
};

const guessMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext ?? ''] ?? 'application/octet-stream';
};
