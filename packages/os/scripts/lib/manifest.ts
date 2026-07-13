import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyManifestOverlay, readManifestOverlay } from './manifest-overlay';
import type { OsManifestEntry } from './types';

type JsonObject = Record<string, unknown>;

type CanonicalManifestEntry = {
  name: string;
  kind: 'os-skill' | 'facade-tool';
  definition: JsonObject;
};

type CanonicalToolManifest = {
  version: 1;
  kind: 'consuelo-os-tool-manifest' | 'consuelo-os-core-manifest';
  tools: CanonicalManifestEntry[];
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..', '..');
const fullManifestPath = path.join(packageRoot, 'manifests', 'tool.manifest.json');
const coreManifestPath = path.join(packageRoot, 'manifests', 'core.manifest.json');

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readToolManifest(filePath: string): CanonicalToolManifest {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (!isObject(parsed) || !Array.isArray(parsed.tools)) {
    throw new Error(`${filePath}: expected generated OS tool manifest with tools array`);
  }

  return parsed as CanonicalToolManifest;
}

function isOsManifestEntry(value: unknown): value is OsManifestEntry {
  if (!isObject(value)) return false;
  const implementation = value.implementation;

  return typeof value.name === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.permission === 'string'
    && typeof value.requiresApproval === 'boolean'
    && typeof value.writesRecords === 'boolean'
    && typeof value.externalSideEffects === 'boolean'
    && isObject(implementation)
    && typeof implementation.script === 'string';
}

export function readFullToolManifest(): CanonicalToolManifest {
  return readToolManifest(fullManifestPath);
}

export function readCoreToolManifest(): CanonicalToolManifest {
  return readToolManifest(coreManifestPath);
}

export function readEffectiveFullManifest(home?: string): CanonicalToolManifest {
  return applyManifestOverlay(readFullToolManifest(), readManifestOverlay(home));
}

export function readEffectiveCoreManifest(home?: string): CanonicalToolManifest {
  return applyManifestOverlay(readCoreToolManifest(), readManifestOverlay(home));
}

export function readManifest(home?: string): OsManifestEntry[] {
  return readEffectiveFullManifest(home).tools
    .filter((entry) => entry.kind === 'os-skill')
    .map((entry) => {
      if (!isOsManifestEntry(entry.definition)) {
        throw new Error(`${fullManifestPath}: ${entry.name} is not a valid OS skill manifest entry`);
      }

      return entry.definition;
    });
}

export function findManifestEntry(name: string, home?: string): OsManifestEntry | null {
  return readManifest(home).find((entry) => entry.name === name) ?? null;
}

export function getPackageRoot(): string {
  return packageRoot;
}