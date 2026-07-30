import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  reconcileManagedUserContent,
  type ManagedUserContentAction,
} from './managed-user-content';
import { ensureNodeEncryptionKey } from './node-encryption-key-file';

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
  } catch {
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

  return reconcileManagedUserContent({
    userRoot,
    tools,
    skillsIndex,
    steeringBody,
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
  home = process.env.CONSUELO_HOME,
): string | undefined {
  if (!home) return undefined;
  try {
    const globalConfigPath = path.join(home, 'consuelo.yaml');
    if (!fs.existsSync(globalConfigPath)) return undefined;
    const raw = fs.readFileSync(globalConfigPath, 'utf8');
    const workspaceId = /^activeWorkspace:\s*(\S+)\s*$/m.exec(raw)?.[1];
    const nodeId = /^activeNode:\s*(\S+)\s*$/m.exec(raw)?.[1];
    if (!workspaceId || !nodeId) return undefined;
    return ensureNodeEncryptionKey({
      nodeHome: path.join(home, 'node'),
      workspaceId,
      nodeId,
    }).publicKeyJwk;
  } catch {
    // A key that cannot be minted is surfaced by doctor; it must not fail a release activation.
    return undefined;
  }
}
