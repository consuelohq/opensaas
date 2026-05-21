import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SkillManifestEntry } from './types';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..', '..');
const manifestPath = path.join(packageRoot, 'tooling', 'tool-manifest.json');

export function readManifest(): SkillManifestEntry[] {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw) as SkillManifestEntry[];
}

export function findManifestEntry(name: string): SkillManifestEntry | null {
  return readManifest().find((entry) => entry.name === name) ?? null;
}

export function getPackageRoot(): string {
  return packageRoot;
}
