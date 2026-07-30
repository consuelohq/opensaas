#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';

import { resolveConsueloHomeLayout } from './lib/consuelo-home';
import {
  sealCredential,
  type SealedCredentialEnvelope,
} from './lib/node-credential-sealing';
import {
  ensureNodeEncryptionKey,
  loadNodeEncryptionPrivateKey,
  readNodeEncryptionPublicKey,
} from './lib/node-encryption-key-file';
import {
  credentialStatus,
  installSealedCredential,
  listSealedCredentials,
  removeSealedCredential,
} from './lib/node-sealed-credential-store';

/**
 * Credential setup ceremony.
 *
 * Two flows:
 *
 *   local  - `set` reads the value from stdin, seals it to this node's own key, and installs it.
 *   remote - `seal` runs where the value is known and produces an envelope only the target node can
 *            open; `install` runs on that node. This is what lets an always-on cloud node hold a
 *            credential without the value ever existing in plaintext on the wire or in the control
 *            plane.
 *
 * A value is never accepted as a command-line argument. Shell history and `ps` both expose argv, so
 * the only input path is stdin.
 */

const USAGE = `usage: secrets <command>

  node-key                       print this node's public encryption key
  status <BINDING>               report set or missing for a binding
  list                           list bindings held on this node
  set <BINDING>                  read a value from stdin and store it on this node
  seal <BINDING> --public-key <file> --node <nodeId> [--out <file>]
                                 seal a value from stdin for a remote node
  install <BINDING> --envelope <file>
                                 install an envelope delivered to this node
  remove <BINDING>               remove a binding from this node

flags:
  --json                         emit a single structured JSON object
  --quiet                        suppress human-oriented output

values are read from stdin only, never from arguments:
  printf %s "$TOKEN" | secrets set GITHUB_TOKEN
`;

/**
 * Output contract. AGENTS.md requires --json and --quiet on project CLI surfaces so automation can
 * parse a stable shape or suppress output entirely. Values are never part of either mode.
 */
type OutputMode = { json: boolean; quiet: boolean };

const emit = (
  mode: OutputMode,
  human: string,
  structured: Record<string, unknown>,
): void => {
  if (mode.json) {
    process.stdout.write(`${JSON.stringify(structured)}\n`);
    return;
  }
  if (mode.quiet) return;
  process.stdout.write(`${human}\n`);
};

type Context = {
  home: string;
  nodeHome: string;
  workspaceId: string;
  nodeId: string;
};

/**
 * The ceremony is a human action at a terminal, so the actor is the operator rather than an agent.
 * Recorded so a credential appearing on a node is always attributable.
 */
const ceremonyActor = (context: Context) => ({
  actorType: 'user' as const,
  actorId: 'operator:cli',
  workspaceId: context.workspaceId,
  correlationId: `secrets_${Date.now().toString(36)}`,
  nodeId: context.nodeId,
});

let outputMode: OutputMode = { json: false, quiet: false };

const die = (message: string, code = 1): never => {
  if (outputMode.json) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  } else {
    process.stderr.write(`${message}\n`);
  }
  process.exit(code);
};

const flag = (argv: string[], name: string): string | undefined => {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    die(`--${name} requires a value`);
  }
  return value;
};

const readContext = (): Context => {
  const layout = resolveConsueloHomeLayout();
  const home = layout.home;
  const nodeHome = path.join(home, 'node');

  const configPath = path.join(home, 'config.json');
  if (!fs.existsSync(configPath)) {
    die(`Consuelo OS config not found at ${configPath}`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const workspaceId = config?.workspace?.id;
  if (typeof workspaceId !== 'string' || workspaceId === '') {
    die('Consuelo OS config does not name a workspace');
  }

  const globalConfigPath = path.join(home, 'consuelo.yaml');
  const activeNode = fs.existsSync(globalConfigPath)
    ? /^activeNode:\s*(\S+)\s*$/m.exec(fs.readFileSync(globalConfigPath, 'utf8'))?.[1]
    : undefined;
  if (!activeNode) {
    die('Consuelo OS config does not name an active node');
  }

  return { home, nodeHome, workspaceId, nodeId: activeNode! };
};

/**
 * Reads the value from stdin. Requires a pipe rather than an interactive TTY, so a value is never
 * echoed into a terminal scrollback by accident.
 */
const readValueFromStdin = async (): Promise<string> => {
  if (process.stdin.isTTY) {
    die(
      'a credential value must be piped on stdin, not typed interactively:\n' +
        '  printf %s "$TOKEN" | secrets set BINDING',
    );
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  // Strip exactly one trailing newline, which `echo` and most heredocs add. Anything beyond that is
  // preserved, because some credentials (PEM keys) legitimately end in a newline.
  const raw = Buffer.concat(chunks).toString('utf8');
  const value = raw.endsWith('\n') ? raw.slice(0, -1) : raw;
  if (value === '') {
    die('no credential value was provided on stdin');
  }
  return value;
};

const readJsonFile = <T>(file: string, label: string): T => {
  if (!fs.existsSync(file)) die(`${label} not found: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch (_error: unknown) {
    return die(`${label} is not valid JSON: ${file}`) as never;
  }
};

const commands: Record<string, (argv: string[], context: Context) => Promise<void> | void> = {
  'node-key': (_argv, context) => {
    const published =
      readNodeEncryptionPublicKey({ nodeHome: context.nodeHome }) ??
      ensureNodeEncryptionKey({
        nodeHome: context.nodeHome,
        workspaceId: context.workspaceId,
        nodeId: context.nodeId,
      });
    emit(
      outputMode,
      JSON.stringify(published, null, 2),
      { ok: true, command: 'node-key', ...published },
    );
  },

  status: (argv, context) => {
    const bindingId = argv[0] ?? die('status requires a binding');
    const status = credentialStatus({
      home: context.home,
      workspaceId: context.workspaceId,
      nodeId: context.nodeId,
      bindingId,
    });
    emit(outputMode, status, {
      ok: true,
      command: 'status',
      bindingId,
      status,
    });
  },

  list: (_argv, context) => {
    const entries = listSealedCredentials({
      home: context.home,
      workspaceId: context.workspaceId,
      nodeId: context.nodeId,
    });
    emit(
      outputMode,
      entries.length === 0
        ? 'no credentials are set on this node'
        : entries
            .map((entry) => `${entry.status.padEnd(8)} ${entry.bindingId}`)
            .join('\n'),
      { ok: true, command: 'list', credentials: entries },
    );
  },

  set: async (argv, context) => {
    const bindingId = argv[0] ?? die('set requires a binding');
    // Read the value inside its own guard so a stdin failure cannot surface a partial message that
    // includes anything already buffered.
    let value: string;
    try {
      value = await readValueFromStdin();
    } catch (error: unknown) {
      return die(
        error instanceof Error ? error.message : 'reading the value failed',
      );
    }
    const published = ensureNodeEncryptionKey({
      nodeHome: context.nodeHome,
      workspaceId: context.workspaceId,
      nodeId: context.nodeId,
    });
    const recipient = {
      workspaceId: context.workspaceId,
      nodeId: context.nodeId,
      bindingId,
    };
    // Even locally the value goes through the sealed path, so there is exactly one install code
    // path to review rather than a shortcut that skips the envelope checks.
    installSealedCredential({
      home: context.home,
      nodePrivateKeyJwk: loadNodeEncryptionPrivateKey({
        nodeHome: context.nodeHome,
        workspaceId: context.workspaceId,
        nodeId: context.nodeId,
      }),
      recipient,
      envelope: sealCredential({
        recipientPublicKeyJwk: published.publicKeyJwk,
        recipient,
        plaintext: value,
      }),
      actor: ceremonyActor(context),
    });
    emit(outputMode, `set ${bindingId} on ${context.nodeId}`, {
      ok: true,
      command: 'set',
      bindingId,
      nodeId: context.nodeId,
    });
  },

  seal: async (argv, context) => {
    const bindingId = argv[0] ?? die('seal requires a binding');
    const publicKeyFile = flag(argv, 'public-key') ?? die('seal requires --public-key');
    const targetNodeId = flag(argv, 'node') ?? die('seal requires --node');
    const outFile = flag(argv, 'out');

    const published = readJsonFile<{ publicKeyJwk: string; nodeId?: string }>(
      publicKeyFile!,
      'public key file',
    );
    if (published.nodeId && published.nodeId !== targetNodeId) {
      die(
        `public key file belongs to ${published.nodeId}, not ${targetNodeId}`,
      );
    }
    // Read the value under its own guard, so a stdin failure is reported without the partially
    // consumed input reaching an error message.
    let plaintext: string;
    try {
      plaintext = await readValueFromStdin();
    } catch (error: unknown) {
      return die(
        error instanceof Error ? error.message : 'reading the value failed',
      );
    }
    const envelope = sealCredential({
      recipientPublicKeyJwk: published.publicKeyJwk,
      recipient: {
        workspaceId: context.workspaceId,
        nodeId: targetNodeId!,
        bindingId,
      },
      plaintext,
    });
    const serialized = `${JSON.stringify(envelope, null, 2)}\n`;
    if (outFile) {
      fs.writeFileSync(outFile, serialized, { mode: 0o600 });
      fs.chmodSync(outFile, 0o600);
      emit(
        outputMode,
        `sealed ${bindingId} for ${targetNodeId} -> ${outFile}`,
        { ok: true, command: 'seal', bindingId, nodeId: targetNodeId, out: outFile },
      );
      return;
    }
    process.stdout.write(serialized);
  },

  install: (argv, context) => {
    const bindingId = argv[0] ?? die('install requires a binding');
    const envelopeFile = flag(argv, 'envelope') ?? die('install requires --envelope');
    const envelope = readJsonFile<SealedCredentialEnvelope>(
      envelopeFile!,
      'envelope file',
    );
    installSealedCredential({
      home: context.home,
      nodePrivateKeyJwk: loadNodeEncryptionPrivateKey({
        nodeHome: context.nodeHome,
        workspaceId: context.workspaceId,
        nodeId: context.nodeId,
      }),
      recipient: {
        workspaceId: context.workspaceId,
        nodeId: context.nodeId,
        bindingId,
      },
      envelope,
      actor: ceremonyActor(context),
    });
    emit(outputMode, `installed ${bindingId} on ${context.nodeId}`, {
      ok: true,
      command: 'install',
      bindingId,
      nodeId: context.nodeId,
    });
  },

  remove: (argv, context) => {
    const bindingId = argv[0] ?? die('remove requires a binding');
    removeSealedCredential({
      home: context.home,
      bindingId,
      actor: ceremonyActor(context),
    });
    emit(outputMode, `removed ${bindingId} from ${context.nodeId}`, {
      ok: true,
      command: 'remove',
      bindingId,
      nodeId: context.nodeId,
    });
  },
};

async function main(): Promise<void> {
  const raw = process.argv.slice(2);
  outputMode = {
    json: raw.includes('--json'),
    quiet: raw.includes('--quiet'),
  };
  // Strip output flags wherever they appear, so a leading flag is not mistaken for a command and a
  // trailing one is not mistaken for a binding.
  const argv = raw.filter((arg) => arg !== '--json' && arg !== '--quiet');
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(USAGE);
    return;
  }
  const handler = commands[command];
  if (!handler) {
    process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
    process.exit(1);
  }
  try {
    await handler(rest, readContext());
  } catch (error: unknown) {
    // Typed failures from the credential modules already carry safe messages with no value or key
    // material in them, so the message can be surfaced directly.
    die((error as Error).message ?? 'secrets command failed');
  }
}

await main();
