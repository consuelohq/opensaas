import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  reconcileManagedUserContent,
  type ManagedUserContentAction,
} from './managed-user-content';
import { ensureNodeEncryptionKey } from './node-encryption-key-file';
import { resolveOsHomeFromEnvironment } from './workspace-project-cwd';

/**
 * Reconciles visible user content against a specific runtime release.
 *
 * Split from `managed-user-content` so the lifecycle engine can call it without importing
 * `install-state`, which pulls in the whole provisioning surface.
 *
 * The catalog and skills index are read from the release being activated rather than from the
 * currently linked runtime, so the content describes what the user is about to be running instead
 * of what they were running a moment ago.
 */

const readJson = <T>(file: string): T | undefined => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch (_error: unknown) {
    return undefined;
  }
};

export function resolveVisibleUserRoot(
  userHome = process.env.CONSUELO_USER_HOME?.trim() || os.homedir(),
): string {
  return path.join(userHome, 'Consuelo');
}

export function reconcileManagedUserContentForRelease(input: {
  releasePath: string;
  userRoot?: string;
}): ManagedUserContentAction[] {
  const userRoot = input.userRoot ?? resolveVisibleUserRoot();
  const manifest = readJson<{
    tools?: Array<{ name: string; description?: string }>;
  }>(
    path.join(
      input.releasePath,
      'manifests',
      'generated',
      'tool.manifest.json',
    ),
  );
  // With no manifest there is no catalog to write, but the system prompt and example still matter,
  // so reconcile with an empty tool list rather than skipping entirely.
  const tools = manifest?.tools ?? [];

  const skillsIndexPath = path.join(input.releasePath, 'skills', 'skills.json');
  const skillsIndex = fs.existsSync(skillsIndexPath)
    ? fs.readFileSync(skillsIndexPath, 'utf8')
    : undefined;

  // Read from the release being activated, so the example is exactly the steering this node serves.
  const steeringPath = path.join(
    input.releasePath,
    'steering',
    'system_prompt.md',
  );
  const steeringBody = fs.existsSync(steeringPath)
    ? fs.readFileSync(steeringPath, 'utf8')
    : undefined;
  const rootAgentInstructionsPath = path.join(
    input.releasePath,
    'steering',
    'root-agent-instructions.md',
  );
  const rootAgentInstructionsBody = fs.existsSync(rootAgentInstructionsPath)
    ? fs.readFileSync(rootAgentInstructionsPath, 'utf8')
    : undefined;

  return reconcileManagedUserContent({
    userRoot,
    tools,
    skillsIndex,
    steeringBody,
    rootAgentInstructionsBody,
  });
}

/**
 * Ensures the node has its credential-encryption keypair.
 *
 * Minting happened only in the install path, so a node that reached its current state through
 * `consuelo update` had no encryption key and could not receive a sealed credential at all — the
 * secrets path was inert for exactly the users who never reinstall. This runs after every release
 * activation and is idempotent, so an existing key is reused rather than rotated; rotating here
 * would orphan every credential already sealed to the node.
 *
 * Returns undefined when the home has no workspace or node identity yet, which is the normal state
 * before onboarding completes.
 */
export function ensureNodeEncryptionKeyForHome(
  home = resolveOsHomeFromEnvironment(),
): string | undefined {
  if (!home) return undefined;
  try {
    const globalConfigPath = path.join(home, 'consuelo.yaml');
    if (!fs.existsSync(globalConfigPath)) return undefined;
    const raw = fs.readFileSync(globalConfigPath, 'utf8');
    const workspaceId = /^activeWorkspace:\s*(\S+)\s*$/m.exec(raw)?.[1];
    const nodeId = /^activeNode:\s*(\S+)\s*$/m.exec(raw)?.[1];
    if (!workspaceId || !nodeId) return undefined;
    const published = ensureNodeEncryptionKey({
      nodeHome: path.join(home, 'node'),
      workspaceId,
      nodeId,
    }).publicKeyJwk;
    // Publish it into the heartbeat config too. A key minted here is created after install wrote
    // that file, so without this the control plane never learns about a key created during an
    // update and the node still cannot receive a sealed credential.
    publishEncryptionKeyToHeartbeatConfig({ home, publicKeyJwk: published });
    return published;
  } catch (_error: unknown) {
    // A key that cannot be minted is surfaced by doctor; it must not fail a release activation.
    return undefined;
  }
}

/**
 * Records the node's encryption public key in the heartbeat config so the next heartbeat carries
 * it. Best effort: a node whose heartbeat config is absent or unreadable is still usable, it just
 * cannot receive sealed credentials until the config is repaired.
 */
function publishEncryptionKeyToHeartbeatConfig(input: {
  home: string;
  publicKeyJwk: string;
}): void {
  const file = path.join(
    input.home,
    'node',
    'security',
    'generated',
    'workspace-node-heartbeat.json',
  );
  try {
    if (!fs.existsSync(file)) return;
    const config = readJson<Record<string, unknown>>(file);
    if (!config) return;
    if (config.encryptionPublicKeyJwk === input.publicKeyJwk) return;
    fs.writeFileSync(
      file,
      `${JSON.stringify({ ...config, encryptionPublicKeyJwk: input.publicKeyJwk }, null, 2)}\n`,
      { mode: 0o600 },
    );
    fs.chmodSync(file, 0o600);
  } catch (_error: unknown) {
    // Surfaced by doctor rather than failing an accepted release.
  }
}
