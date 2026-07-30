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

values are read from stdin only, never from arguments:
  printf %s "$TOKEN" | secrets set GITHUB_TOKEN
`;

type Context = {
  home: string;
  nodeHome: string;
  workspaceId: string;
  nodeId: string;
};

const die = (message: string, code = 1): never => {
  process.stderr.write(`${message}\n`);
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
  } catch {
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
    process.stdout.write(`${JSON.stringify(published, null, 2)}\n`);
  },

  status: (argv, context) => {
    const bindingId = argv[0] ?? die('status requires a binding');
    process.stdout.write(
      `${credentialStatus({
        home: context.home,
        workspaceId: context.workspaceId,
        nodeId: context.nodeId,
        bindingId,
      })}\n`,
    );
  },

  list: (_argv, context) => {
    const entries = listSealedCredentials({
      home: context.home,
      workspaceId: context.workspaceId,
      nodeId: context.nodeId,
    });
    if (entries.length === 0) {
      process.stdout.write('no credentials are set on this node\n');
      return;
    }
    for (const entry of entries) {
      process.stdout.write(`${entry.status.padEnd(8)} ${entry.bindingId}\n`);
    }
  },

  set: async (argv, context) => {
    const bindingId = argv[0] ?? die('set requires a binding');
    const value = await readValueFromStdin();
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
    });
    process.stdout.write(`set ${bindingId} on ${context.nodeId}\n`);
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
    const envelope = sealCredential({
      recipientPublicKeyJwk: published.publicKeyJwk,
      recipient: {
        workspaceId: context.workspaceId,
        nodeId: targetNodeId!,
        bindingId,
      },
      plaintext: await readValueFromStdin(),
    });
    const serialized = `${JSON.stringify(envelope, null, 2)}\n`;
    if (outFile) {
      fs.writeFileSync(outFile, serialized, { mode: 0o600 });
      fs.chmodSync(outFile, 0o600);
      process.stdout.write(`sealed ${bindingId} for ${targetNodeId} -> ${outFile}\n`);
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
    });
    process.stdout.write(`installed ${bindingId} on ${context.nodeId}\n`);
  },

  remove: (argv, context) => {
    const bindingId = argv[0] ?? die('remove requires a binding');
    removeSealedCredential({ home: context.home, bindingId });
    process.stdout.write(`removed ${bindingId} from ${context.nodeId}\n`);
  },
};

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
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
  } catch (error) {
    // Typed failures from the credential modules already carry safe messages with no value or key
    // material in them, so the message can be surfaced directly.
    die((error as Error).message ?? 'secrets command failed');
  }
}

await main();
