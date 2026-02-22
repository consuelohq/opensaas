import type {
  SandboxResult,
  SandboxArtifact,
  SandboxExecuteOptions,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_TEMPLATE = 'consuelo-agent';
const OUTPUT_DIR = '/output';
const DATA_DIR = '/data';

export class SandboxService {
  private template: string;

  constructor(template = DEFAULT_TEMPLATE) {
    this.template = template;
  }

  async execute(options: SandboxExecuteOptions): Promise<SandboxResult> {
    const { Sandbox } = await import('e2b');

    const sandbox = await Sandbox.create(this.template, {
      envs: options.envVars ?? {},
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

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

      return {
        stdout: process.stdout,
        stderr: process.stderr,
        exitCode: process.exitCode,
        artifacts,
      };
    } finally {
      await sandbox.kill();
    }
  }

  private async collectArtifacts(
    sandbox: InstanceType<Awaited<ReturnType<typeof importSandbox>>>,
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

// lazy import helper for type inference
async function importSandbox() {
  const { Sandbox } = await import('e2b');
  return Sandbox;
}

function shellEscape(code: string): string {
  return "'" + code.replace(/'/g, "'\\''") + "'";
}

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
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
  return mimeTypes[ext ?? ''] ?? 'application/octet-stream';
}
