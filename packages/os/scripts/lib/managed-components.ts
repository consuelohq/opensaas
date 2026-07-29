import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const managedComponentKinds = [
  'skill',
  'tool',
  'site-template',
  'script',
  'job-template',
] as const;

export const managedComponentOwnership = [
  'bundled-managed',
  'custom',
  'detached',
] as const;

export const managedComponentActions = [
  'install',
  'update-clean',
  'preserve-custom',
  'merge-clean',
  'conflict',
  'remove-upstream',
  'detach',
  'no-change',
] as const;

export type ManagedComponentKind = (typeof managedComponentKinds)[number];
export type ManagedComponentOwnership = (typeof managedComponentOwnership)[number];
export type ManagedComponentAction = (typeof managedComponentActions)[number];

export type ComponentTree = Record<string, string>;

export type ManagedComponentResolutionState =
  | 'clean'
  | 'merged-clean'
  | 'conflict'
  | 'upstream-removed'
  | 'upstream-removed-local-preserved'
  | 'accepted-upstream'
  | 'kept-local'
  | 'reviewed-merge'
  | 'detached';

export type ManagedComponentProvenance = {
  schemaVersion: 1;
  id: string;
  kind: ManagedComponentKind;
  ownership: ManagedComponentOwnership;
  sourceBundleId: string;
  sourceVersion: string;
  sourcePath: string;
  baseHash: string;
  baseContentRef: string;
  localHash: string;
  upstreamHash: string;
  installedAt: string;
  updatedAt: string;
  resolutionState: ManagedComponentResolutionState;
  localPath?: string;
};

export type ManagedComponentSource = {
  id: string;
  kind: ManagedComponentKind;
  sourcePath: string;
  localPath?: string;
  content: ComponentTree;
};

export type ManagedComponentLocal = {
  id: string;
  kind: ManagedComponentKind;
  localPath: string;
  content: ComponentTree;
};

export type ManagedComponentPlanItem = {
  key: string;
  id: string;
  kind: ManagedComponentKind;
  action: ManagedComponentAction;
  ownership: ManagedComponentOwnership;
  sourceBundleId: string;
  sourceVersion: string;
  sourcePath?: string;
  localPath?: string;
  baseHash?: string;
  baseContentRef?: string;
  localHash?: string;
  localContentRef?: string;
  upstreamHash?: string;
  upstreamContentRef?: string;
  mergedHash?: string;
  mergedContentRef?: string;
  requiresReview: boolean;
  resolutionState: ManagedComponentResolutionState;
};

export type ManagedComponentUpdatePlan = {
  schemaVersion: 1;
  kind: 'consuelo-managed-component-update-plan';
  generatedAt: string;
  sourceBundle: {
    bundleId: string;
    version: string;
  };
  summary: {
    total: number;
    requiresReview: number;
    byAction: Record<ManagedComponentAction, number>;
  };
  items: ManagedComponentPlanItem[];
};

export type ManagedComponentState = {
  provenance: ManagedComponentProvenance[];
  plan: ManagedComponentUpdatePlan;
  content: Record<string, ComponentTree>;
};

type LegacyManagedMetadata = {
  version: 1;
  name: string;
  source: 'bundled';
  sourcePath: string;
  hash: string;
  installedAt: string;
  updatedAt: string;
};

type BuildManagedComponentUpdateStateInput = {
  generatedAt: string;
  sourceBundle: {
    bundleId: string;
    version: string;
  };
  provenance: ManagedComponentProvenance[];
  retainedContent: Record<string, ComponentTree>;
  upstream: ManagedComponentSource[];
  localOverrides: ManagedComponentLocal[];
  custom: ManagedComponentLocal[];
};

type TextEdit = {
  start: number;
  end: number;
  replacement: string[];
};

const PLAN_FILE = 'update-plan.json';
const PROVENANCE_FILE = 'provenance.json';
const RETENTION_FILE = 'retention.json';
const CONTENT_DIR = 'content-bases';

function componentKey(kind: ManagedComponentKind, id: string): string {
  return `${kind}:${id}`;
}

function compareKeys(left: { kind: ManagedComponentKind; id: string }, right: { kind: ManagedComponentKind; id: string }): number {
  return componentKey(left.kind, left.id).localeCompare(componentKey(right.kind, right.id));
}

function assertComponentId(id: string): void {
  if (!id || id.includes('/') || id.includes('\\') || id === '.' || id === '..') {
    throw new Error(`invalid managed component id: ${id}`);
  }
}

function assertRelativeTreePath(path: string): void {
  if (!path || isAbsolute(path)) throw new Error(`component content path must be relative: ${path}`);
  const normalized = path.replaceAll('\\', '/');
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`component content path escapes its root: ${path}`);
  }
}

const SECRET_COMPONENT_PATH = /(^|\/)(?:\.env(?:\..*)?|secrets?|credentials?|id_rsa|id_ed25519|[^/]+\.(?:pem|key|p12|pfx))(?:$|\/)/i;
const SECRET_COMPONENT_CONTENT = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:AWS_SECRET_ACCESS_KEY|DATABASE_URL|PRIVATE_KEY|AUTH_TOKEN|ACCESS_TOKEN|REFRESH_TOKEN)\s*[:=]\s*\S+/i,
] as const;

function assertNoSecretMaterial(path: string, value: string): void {
  const normalized = path.replaceAll('\\', '/');
  if (SECRET_COMPONENT_PATH.test(normalized) || SECRET_COMPONENT_CONTENT.some((pattern) => pattern.test(value))) {
    throw new Error(`secret-bearing component content is not allowed: ${normalized}`);
  }
}

function canonicalTree(tree: ComponentTree): ComponentTree {
  const canonical: ComponentTree = {};
  for (const path of Object.keys(tree).sort((left, right) => left.localeCompare(right))) {
    assertRelativeTreePath(path);
    const value = tree[path];
    if (typeof value !== 'string') throw new Error(`component content must be UTF-8 text: ${path}`);
    assertNoSecretMaterial(path, value);
    canonical[path.replaceAll('\\', '/')] = value;
  }
  return canonical;
}

export function hashComponentTree(tree: ComponentTree): string {
  const hash = createHash('sha256');
  const canonical = canonicalTree(tree);
  for (const [path, content] of Object.entries(canonical)) {
    hash.update(path);
    hash.update('\0');
    hash.update(content, 'utf8');
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

function putContent(store: Record<string, ComponentTree>, tree: ComponentTree): string {
  const canonical = canonicalTree(tree);
  const ref = hashComponentTree(canonical);
  store[ref] = canonical;
  return ref;
}

function requireContent(store: Record<string, ComponentTree>, ref: string | undefined, label: string): ComponentTree {
  if (!ref) throw new Error(`${label} content reference is missing`);
  const content = store[ref];
  if (!content) throw new Error(`${label} content is unavailable: ${ref}`);
  return content;
}

function splitLines(value: string): string[] {
  if (!value) return [];
  return value.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function singleTextEdit(base: string[], next: string[]): TextEdit {
  let prefix = 0;
  while (prefix < base.length && prefix < next.length && base[prefix] === next[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < base.length - prefix
    && suffix < next.length - prefix
    && base[base.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    start: prefix,
    end: base.length - suffix,
    replacement: next.slice(prefix, next.length - suffix),
  };
}

function editsEqual(left: TextEdit, right: TextEdit): boolean {
  return left.start === right.start
    && left.end === right.end
    && left.replacement.length === right.replacement.length
    && left.replacement.every((line, index) => line === right.replacement[index]);
}

function editsOverlap(left: TextEdit, right: TextEdit): boolean {
  if (editsEqual(left, right)) return false;
  const leftInsertion = left.start === left.end;
  const rightInsertion = right.start === right.end;
  if (leftInsertion && rightInsertion && left.start === right.start) return true;
  return !(left.end <= right.start || right.end <= left.start);
}

function applyTextEdits(base: string[], edits: TextEdit[]): string[] {
  const result = [...base];
  const unique = edits.filter((edit, index) => index === 0 || !editsEqual(edit, edits[index - 1]));
  for (const edit of unique.sort((left, right) => right.start - left.start || right.end - left.end)) {
    result.splice(edit.start, edit.end - edit.start, ...edit.replacement);
  }
  return result;
}

function mergeText(base: string, local: string, upstream: string): { clean: true; content: string } | { clean: false } {
  if (local === upstream) return { clean: true, content: local };
  if (local === base) return { clean: true, content: upstream };
  if (upstream === base) return { clean: true, content: local };

  const baseLines = splitLines(base);
  const localEdit = singleTextEdit(baseLines, splitLines(local));
  const upstreamEdit = singleTextEdit(baseLines, splitLines(upstream));
  if (editsOverlap(localEdit, upstreamEdit)) return { clean: false };
  return {
    clean: true,
    content: applyTextEdits(baseLines, [localEdit, upstreamEdit]).join(''),
  };
}

function mergeTrees(
  base: ComponentTree,
  local: ComponentTree,
  upstream: ComponentTree,
): { clean: true; content: ComponentTree } | { clean: false } {
  const merged: ComponentTree = {};
  const paths = [...new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(upstream),
  ])].sort((left, right) => left.localeCompare(right));

  for (const path of paths) {
    const baseValue = base[path];
    const localValue = local[path];
    const upstreamValue = upstream[path];
    let value: string | undefined;

    if (localValue === upstreamValue) value = localValue;
    else if (localValue === baseValue) value = upstreamValue;
    else if (upstreamValue === baseValue) value = localValue;
    else if (baseValue !== undefined && localValue !== undefined && upstreamValue !== undefined) {
      const textMerge = mergeText(baseValue, localValue, upstreamValue);
      if (!textMerge.clean) return { clean: false };
      value = textMerge.content;
    } else {
      return { clean: false };
    }

    if (value !== undefined) merged[path] = value;
  }

  return { clean: true, content: canonicalTree(merged) };
}

function mapByKey<T extends { id: string; kind: ManagedComponentKind }>(items: T[], label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    assertComponentId(item.id);
    const key = componentKey(item.kind, item.id);
    if (result.has(key)) throw new Error(`duplicate ${label} component: ${key}`);
    result.set(key, item);
  }
  return result;
}

function copyProvenance(record: ManagedComponentProvenance): ManagedComponentProvenance {
  return { ...record };
}

function emptyActionCounts(): Record<ManagedComponentAction, number> {
  return {
    install: 0,
    'update-clean': 0,
    'preserve-custom': 0,
    'merge-clean': 0,
    conflict: 0,
    'remove-upstream': 0,
    detach: 0,
    'no-change': 0,
  };
}

function basePlanItem(input: {
  id: string;
  kind: ManagedComponentKind;
  ownership: ManagedComponentOwnership;
  action: ManagedComponentAction;
  sourceBundle: { bundleId: string; version: string };
  sourcePath?: string;
  localPath?: string;
  baseHash?: string;
  baseContentRef?: string;
  localHash?: string;
  localContentRef?: string;
  upstreamHash?: string;
  upstreamContentRef?: string;
  mergedHash?: string;
  mergedContentRef?: string;
  requiresReview?: boolean;
  resolutionState: ManagedComponentResolutionState;
}): ManagedComponentPlanItem {
  return {
    key: componentKey(input.kind, input.id),
    id: input.id,
    kind: input.kind,
    action: input.action,
    ownership: input.ownership,
    sourceBundleId: input.sourceBundle.bundleId,
    sourceVersion: input.sourceBundle.version,
    ...(input.sourcePath ? { sourcePath: input.sourcePath } : {}),
    ...(input.localPath ? { localPath: input.localPath } : {}),
    ...(input.baseHash ? { baseHash: input.baseHash } : {}),
    ...(input.baseContentRef ? { baseContentRef: input.baseContentRef } : {}),
    ...(input.localHash ? { localHash: input.localHash } : {}),
    ...(input.localContentRef ? { localContentRef: input.localContentRef } : {}),
    ...(input.upstreamHash ? { upstreamHash: input.upstreamHash } : {}),
    ...(input.upstreamContentRef ? { upstreamContentRef: input.upstreamContentRef } : {}),
    ...(input.mergedHash ? { mergedHash: input.mergedHash } : {}),
    ...(input.mergedContentRef ? { mergedContentRef: input.mergedContentRef } : {}),
    requiresReview: input.requiresReview ?? false,
    resolutionState: input.resolutionState,
  };
}

export function buildManagedComponentUpdateState(
  input: BuildManagedComponentUpdateStateInput,
): ManagedComponentState {
  const content: Record<string, ComponentTree> = {};
  for (const [ref, tree] of Object.entries(input.retainedContent).sort(([left], [right]) => left.localeCompare(right))) {
    const canonical = canonicalTree(tree);
    if (hashComponentTree(canonical) !== ref) throw new Error(`retained component content hash mismatch: ${ref}`);
    content[ref] = canonical;
  }

  const provenance = [...input.provenance].map(copyProvenance).sort(compareKeys);
  const provenanceByKey = mapByKey(provenance, 'provenance');
  const upstreamByKey = mapByKey(input.upstream, 'upstream');
  const localByKey = mapByKey(input.localOverrides, 'local override');
  const customByKey = mapByKey(input.custom, 'custom');

  for (const source of input.upstream) putContent(content, source.content);
  for (const local of input.localOverrides) putContent(content, local.content);
  for (const custom of input.custom) putContent(content, custom.content);

  const allKeys = [...new Set([
    ...provenanceByKey.keys(),
    ...upstreamByKey.keys(),
    ...localByKey.keys(),
    ...customByKey.keys(),
  ])].sort((left, right) => left.localeCompare(right));

  const items: ManagedComponentPlanItem[] = [];
  for (const key of allKeys) {
    const record = provenanceByKey.get(key);
    const upstream = upstreamByKey.get(key);
    const local = localByKey.get(key);
    const custom = customByKey.get(key);
    const identity = record ?? upstream ?? local ?? custom;
    if (!identity) continue;

    if (custom) {
      const localRef = putContent(content, custom.content);
      items.push(basePlanItem({
        id: custom.id,
        kind: custom.kind,
        ownership: 'custom',
        action: 'preserve-custom',
        sourceBundle: input.sourceBundle,
        sourcePath: upstream?.sourcePath,
        localPath: custom.localPath,
        localHash: localRef,
        localContentRef: localRef,
        upstreamHash: upstream ? putContent(content, upstream.content) : undefined,
        upstreamContentRef: upstream ? hashComponentTree(upstream.content) : undefined,
        resolutionState: 'clean',
      }));
      continue;
    }

    if (!record) {
      if (upstream) {
        const upstreamRef = putContent(content, upstream.content);
        const localRef = local ? putContent(content, local.content) : undefined;
        const matchesUpstream = localRef === upstreamRef;
        items.push(basePlanItem({
          id: upstream.id,
          kind: upstream.kind,
          ownership: 'bundled-managed',
          action: local
            ? matchesUpstream
              ? 'no-change'
              : 'conflict'
            : 'install',
          sourceBundle: input.sourceBundle,
          sourcePath: upstream.sourcePath,
          localPath: local?.localPath ?? upstream.localPath,
          ...(matchesUpstream
            ? {
                baseHash: upstreamRef,
                baseContentRef: upstreamRef,
              }
            : {}),
          ...(localRef
            ? {
                localHash: localRef,
                localContentRef: localRef,
              }
            : {}),
          upstreamHash: upstreamRef,
          upstreamContentRef: upstreamRef,
          requiresReview: Boolean(local && !matchesUpstream),
          resolutionState: local && !matchesUpstream ? 'conflict' : 'clean',
        }));
      } else if (local) {
        const localRef = putContent(content, local.content);
        items.push(basePlanItem({
          id: local.id,
          kind: local.kind,
          ownership: 'custom',
          action: 'preserve-custom',
          sourceBundle: input.sourceBundle,
          localPath: local.localPath,
          localHash: localRef,
          localContentRef: localRef,
          resolutionState: 'clean',
        }));
      }
      continue;
    }

    if (record.ownership === 'detached') {
      items.push(basePlanItem({
        id: record.id,
        kind: record.kind,
        ownership: 'detached',
        action: 'detach',
        sourceBundle: input.sourceBundle,
        sourcePath: upstream?.sourcePath ?? record.sourcePath,
        localPath: local?.localPath ?? record.localPath ?? upstream?.localPath,
        baseHash: record.baseHash,
        baseContentRef: record.baseContentRef,
        localHash: local ? putContent(content, local.content) : record.localHash,
        localContentRef: local ? hashComponentTree(local.content) : undefined,
        upstreamHash: upstream ? putContent(content, upstream.content) : record.upstreamHash,
        upstreamContentRef: upstream ? hashComponentTree(upstream.content) : undefined,
        resolutionState: 'detached',
      }));
      continue;
    }

    if (record.ownership === 'custom') {
      const localTree = custom?.content ?? local?.content;
      const localRef = localTree ? putContent(content, localTree) : record.localHash;
      items.push(basePlanItem({
        id: record.id,
        kind: record.kind,
        ownership: 'custom',
        action: 'preserve-custom',
        sourceBundle: input.sourceBundle,
        sourcePath: upstream?.sourcePath ?? record.sourcePath,
        localPath: custom?.localPath ?? local?.localPath ?? record.localPath ?? upstream?.localPath,
        baseHash: record.baseHash,
        baseContentRef: record.baseContentRef,
        localHash: localRef,
        localContentRef: localTree ? localRef : undefined,
        upstreamHash: upstream ? putContent(content, upstream.content) : record.upstreamHash,
        upstreamContentRef: upstream ? hashComponentTree(upstream.content) : undefined,
        resolutionState: record.resolutionState,
      }));
      continue;
    }

    const base = requireContent(content, record.baseContentRef, `base for ${key}`);
    if (hashComponentTree(base) !== record.baseHash) throw new Error(`base hash mismatch for ${key}`);
    const localTree = local?.content ?? base;
    const localRef = putContent(content, localTree);

    if (!upstream) {
      const modified = localRef !== record.baseHash;
      items.push(basePlanItem({
        id: record.id,
        kind: record.kind,
        ownership: 'bundled-managed',
        action: 'remove-upstream',
        sourceBundle: input.sourceBundle,
        sourcePath: record.sourcePath,
        localPath: local?.localPath ?? record.localPath,
        baseHash: record.baseHash,
        baseContentRef: record.baseContentRef,
        localHash: localRef,
        localContentRef: localRef,
        requiresReview: modified,
        resolutionState: modified ? 'upstream-removed-local-preserved' : 'upstream-removed',
      }));
      continue;
    }

    const upstreamRef = putContent(content, upstream.content);
    if (upstreamRef === record.baseHash) {
      const localModified = localRef !== record.baseHash;
      items.push(basePlanItem({
        id: record.id,
        kind: record.kind,
        ownership: 'bundled-managed',
        action: localModified ? 'preserve-custom' : 'no-change',
        sourceBundle: input.sourceBundle,
        sourcePath: upstream.sourcePath,
        localPath: local?.localPath ?? record.localPath ?? upstream.localPath,
        baseHash: record.baseHash,
        baseContentRef: record.baseContentRef,
        localHash: localRef,
        localContentRef: localRef,
        upstreamHash: upstreamRef,
        upstreamContentRef: upstreamRef,
        resolutionState: localModified ? 'kept-local' : 'clean',
      }));
      continue;
    }

    if (localRef === record.baseHash) {
      items.push(basePlanItem({
        id: record.id,
        kind: record.kind,
        ownership: 'bundled-managed',
        action: 'update-clean',
        sourceBundle: input.sourceBundle,
        sourcePath: upstream.sourcePath,
        localPath: local?.localPath ?? record.localPath ?? upstream.localPath,
        baseHash: record.baseHash,
        baseContentRef: record.baseContentRef,
        localHash: localRef,
        localContentRef: localRef,
        upstreamHash: upstreamRef,
        upstreamContentRef: upstreamRef,
        resolutionState: 'clean',
      }));
      continue;
    }

    const merge = mergeTrees(base, localTree, upstream.content);
    if (merge.clean) {
      const mergedRef = putContent(content, merge.content);
      items.push(basePlanItem({
        id: record.id,
        kind: record.kind,
        ownership: 'bundled-managed',
        action: 'merge-clean',
        sourceBundle: input.sourceBundle,
        sourcePath: upstream.sourcePath,
        localPath: local?.localPath ?? record.localPath ?? upstream.localPath,
        baseHash: record.baseHash,
        baseContentRef: record.baseContentRef,
        localHash: localRef,
        localContentRef: localRef,
        upstreamHash: upstreamRef,
        upstreamContentRef: upstreamRef,
        mergedHash: mergedRef,
        mergedContentRef: mergedRef,
        resolutionState: 'merged-clean',
      }));
    } else {
      items.push(basePlanItem({
        id: record.id,
        kind: record.kind,
        ownership: 'bundled-managed',
        action: 'conflict',
        sourceBundle: input.sourceBundle,
        sourcePath: upstream.sourcePath,
        localPath: local?.localPath ?? record.localPath ?? upstream.localPath,
        baseHash: record.baseHash,
        baseContentRef: record.baseContentRef,
        localHash: localRef,
        localContentRef: localRef,
        upstreamHash: upstreamRef,
        upstreamContentRef: upstreamRef,
        requiresReview: true,
        resolutionState: 'conflict',
      }));
    }
  }

  items.sort(compareKeys);
  const byAction = emptyActionCounts();
  for (const item of items) byAction[item.action] += 1;
  const plan: ManagedComponentUpdatePlan = {
    schemaVersion: 1,
    kind: 'consuelo-managed-component-update-plan',
    generatedAt: input.generatedAt,
    sourceBundle: { ...input.sourceBundle },
    summary: {
      total: items.length,
      requiresReview: items.filter((item) => item.requiresReview).length,
      byAction,
    },
    items,
  };

  return { provenance, plan, content };
}

function componentsRoot(home: string): string {
  return join(resolve(home), 'components');
}

function atomicWriteJson(path: string, value: unknown): void {
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function contentFileName(ref: string): string {
  if (!/^sha256:[a-f0-9]{64}$/.test(ref)) throw new Error(`invalid component content reference: ${ref}`);
  return `${ref.slice('sha256:'.length)}.json`;
}

function referencedContentRefs(state: ManagedComponentState): string[] {
  const refs = new Set<string>();
  for (const record of state.provenance) refs.add(record.baseContentRef);
  for (const item of state.plan.items) {
    for (const ref of [
      item.baseContentRef,
      item.localContentRef,
      item.upstreamContentRef,
      item.mergedContentRef,
    ]) {
      if (ref) refs.add(ref);
    }
  }
  return [...refs].sort((left, right) => left.localeCompare(right));
}

export function writeManagedComponentState(home: string, state: ManagedComponentState): void {
  const root = componentsRoot(home);
  const contentDir = join(root, CONTENT_DIR);
  mkdirSync(contentDir, { recursive: true, mode: 0o700 });

  const referencedRefs = referencedContentRefs(state);
  for (const ref of referencedRefs) {
    const tree = state.content[ref];
    if (!tree) throw new Error(`referenced component content is unavailable: ${ref}`);
    const canonical = canonicalTree(tree);
    if (hashComponentTree(canonical) !== ref) throw new Error(`component content hash mismatch: ${ref}`);
    atomicWriteJson(join(contentDir, contentFileName(ref)), canonical);
  }

  const provenance = [...state.provenance].map(copyProvenance).sort(compareKeys);
  atomicWriteJson(join(root, PROVENANCE_FILE), {
    schemaVersion: 1,
    kind: 'consuelo-managed-component-provenance',
    components: provenance,
  });
  atomicWriteJson(join(root, RETENTION_FILE), {
    schemaVersion: 1,
    kind: 'consuelo-managed-component-retention',
    requiredContentBaseRefs: requiredManagedContentBaseRefs(provenance, state.plan),
  });
  atomicWriteJson(join(root, PLAN_FILE), state.plan);

  const retainedNames = new Set(referencedRefs.map(contentFileName));
  for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) continue;
    if (!retainedNames.has(entry.name)) rmSync(join(contentDir, entry.name), { force: true });
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function readManagedComponentState(home: string): ManagedComponentState {
  const root = componentsRoot(home);
  const provenanceEnvelope = readJson(join(root, PROVENANCE_FILE));
  const plan = readJson(join(root, PLAN_FILE));
  if (
    !isRecord(provenanceEnvelope)
    || provenanceEnvelope.schemaVersion !== 1
    || provenanceEnvelope.kind !== 'consuelo-managed-component-provenance'
    || !Array.isArray(provenanceEnvelope.components)
  ) {
    throw new Error('invalid managed component provenance schema');
  }
  if (
    !isRecord(plan)
    || plan.schemaVersion !== 1
    || plan.kind !== 'consuelo-managed-component-update-plan'
    || !Array.isArray(plan.items)
  ) {
    throw new Error('invalid managed component update plan schema');
  }

  const content: Record<string, ComponentTree> = {};
  const contentDir = join(root, CONTENT_DIR);
  if (existsSync(contentDir)) {
    for (const entry of readdirSync(contentDir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) continue;
      const ref = `sha256:${entry.name.slice(0, -'.json'.length)}`;
      const parsed = readJson(join(contentDir, entry.name));
      if (!isRecord(parsed) || Object.values(parsed).some((value) => typeof value !== 'string')) {
        throw new Error(`invalid component content tree: ${ref}`);
      }
      const tree = canonicalTree(parsed as ComponentTree);
      if (hashComponentTree(tree) !== ref) throw new Error(`stored component content hash mismatch: ${ref}`);
      content[ref] = tree;
    }
  }

  return {
    provenance: (provenanceEnvelope.components as ManagedComponentProvenance[]).map(copyProvenance).sort(compareKeys),
    plan: plan as ManagedComponentUpdatePlan,
    content,
  };
}

function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function resolveInside(root: string, relativePath: string): string {
  if (!relativePath || isAbsolute(relativePath)) throw new Error('managed component destination must be inside the visible user root');
  const resolvedRoot = resolve(root);
  const target = resolve(resolvedRoot, relativePath);
  const rel = relative(resolvedRoot, target);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('managed component destination must be inside the visible user root');
  }
  return target;
}

function assertNoSymlinkPath(root: string, target: string): void {
  const resolvedRoot = resolve(root);
  const rel = relative(resolvedRoot, target);
  let current = resolvedRoot;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = join(current, part);
    if (!pathExists(current)) continue;
    if (lstatSync(current).isSymbolicLink()) throw new Error(`managed component path contains a symbolic link: ${current}`);
  }
}

function decodeTreeValue(value: string): string | Buffer {
  return value.startsWith('base64:')
    ? Buffer.from(value.slice('base64:'.length), 'base64')
    : value;
}

function readFilesystemTree(root: string, relativePath: string): ComponentTree {
  const targetRoot = resolveInside(root, relativePath);
  assertNoSymlinkPath(root, targetRoot);
  if (!pathExists(targetRoot) || !lstatSync(targetRoot).isDirectory()) {
    throw new Error(`managed component changed since the update plan: ${relativePath}`);
  }

  const tree: ComponentTree = {};
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`managed component path contains a symbolic link: ${entryPath}`);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }
      if (!entry.isFile()) throw new Error(`managed component contains an unsupported filesystem entry: ${entryPath}`);
      const bytes = readFileSync(entryPath);
      const relativeFile = relative(targetRoot, entryPath).split(sep).join('/');
      tree[relativeFile] = bytes.includes(0) ? `base64:${bytes.toString('base64')}` : bytes.toString('utf8');
    }
  };
  visit(targetRoot);
  return canonicalTree(tree);
}

export function snapshotManagedComponentLocalOverrides(
  userRoot: string,
  provenance: ManagedComponentProvenance[],
  upstream: ManagedComponentSource[] = [],
): ManagedComponentLocal[] {
  const candidates = new Map<string, {
    id: string;
    kind: ManagedComponentKind;
    localPath: string;
  }>();
  for (const record of provenance) {
    if (record.ownership === 'custom' || !record.localPath) continue;
    const target = resolveInside(userRoot, record.localPath);
    if (
      !pathExists(target) ||
      lstatSync(target).isSymbolicLink() ||
      !lstatSync(target).isDirectory()
    ) {
      continue;
    }
    candidates.set(componentKey(record.kind, record.id), {
      id: record.id,
      kind: record.kind,
      localPath: record.localPath,
    });
  }
  for (const source of upstream) {
    if (!source.localPath) continue;
    const target = resolveInside(userRoot, source.localPath);
    if (
      !pathExists(target) ||
      lstatSync(target).isSymbolicLink() ||
      !lstatSync(target).isDirectory()
    ) {
      continue;
    }
    candidates.set(componentKey(source.kind, source.id), {
      id: source.id,
      kind: source.kind,
      localPath: source.localPath,
    });
  }
  return [...candidates.values()]
    .map((candidate) => ({
      ...candidate,
      content: readFilesystemTree(userRoot, candidate.localPath),
    }))
    .sort(compareKeys);
}

function upstreamSourcesFromState(state: ManagedComponentState): ManagedComponentSource[] {
  const provenanceByKey = mapByKey(state.provenance, 'provenance');
  return state.plan.items
    .filter((item) => Boolean(item.upstreamContentRef))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      sourcePath: item.sourcePath ?? provenanceByKey.get(item.key)?.sourcePath ?? '',
      ...(item.localPath ?? provenanceByKey.get(item.key)?.localPath
        ? { localPath: item.localPath ?? provenanceByKey.get(item.key)?.localPath }
        : {}),
      content: requireContent(state.content, item.upstreamContentRef, `upstream for ${item.key}`),
    }))
    .sort(compareKeys);
}

function customSourcesFromState(state: ManagedComponentState): ManagedComponentLocal[] {
  return state.plan.items
    .filter((item) => item.ownership === 'custom' && Boolean(item.localPath) && Boolean(item.localContentRef))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      localPath: item.localPath!,
      content: requireContent(state.content, item.localContentRef, `custom local for ${item.key}`),
    }))
    .sort(compareKeys);
}

export function refreshManagedComponentPlan(input: {
  home: string;
  userRoot: string;
  generatedAt?: string;
}): ManagedComponentState {
  const previous = readManagedComponentState(input.home);
  const refreshed = buildManagedComponentUpdateState({
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceBundle: previous.plan.sourceBundle,
    provenance: previous.provenance,
    retainedContent: previous.content,
    upstream: upstreamSourcesFromState(previous),
    localOverrides: snapshotManagedComponentLocalOverrides(input.userRoot, previous.provenance),
    custom: customSourcesFromState(previous),
  });
  writeManagedComponentState(input.home, refreshed);
  return refreshed;
}

function assertCurrentLocalMatches(userRoot: string, item: ManagedComponentPlanItem): void {
  if (!item.localPath) return;
  if (!item.localHash) throw new Error(`planned local hash is missing: ${item.key}`);
  const currentHash = hashComponentTree(readFilesystemTree(userRoot, item.localPath));
  if (currentHash !== item.localHash) {
    throw new Error(`managed component changed since the update plan: ${item.key}`);
  }
}

function writeTree(root: string, relativePath: string, tree: ComponentTree, requireNewRoot = false): string {
  const targetRoot = resolveInside(root, relativePath);
  assertNoSymlinkPath(root, targetRoot);
  if (requireNewRoot && pathExists(targetRoot)) throw new Error(`managed component destination already exists: ${relativePath}`);

  const canonical = canonicalTree(tree);
  const parent = dirname(targetRoot);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const nonce = `${process.pid}-${Date.now()}`;
  const temporaryRoot = join(parent, `.${basename(targetRoot)}.consuelo-tmp-${nonce}`);
  const backupRoot = join(parent, `.${basename(targetRoot)}.consuelo-backup-${nonce}`);
  rmSync(temporaryRoot, { recursive: true, force: true });
  rmSync(backupRoot, { recursive: true, force: true });
  mkdirSync(temporaryRoot, { recursive: true, mode: 0o700 });

  try {
    for (const [path, value] of Object.entries(canonical)) {
      const target = resolveInside(temporaryRoot, path);
      mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
      writeFileSync(target, decodeTreeValue(value), { mode: 0o600 });
    }
    if (pathExists(targetRoot)) renameSync(targetRoot, backupRoot);
    renameSync(temporaryRoot, targetRoot);
    rmSync(backupRoot, { recursive: true, force: true });
    return targetRoot;
  } catch (error: unknown) {
    rmSync(temporaryRoot, { recursive: true, force: true });
    if (!pathExists(targetRoot) && pathExists(backupRoot)) renameSync(backupRoot, targetRoot);
    throw error;
  }
}

function findPlanItem(state: ManagedComponentState, key: string): ManagedComponentPlanItem {
  const item = state.plan.items.find((candidate) => candidate.key === key);
  if (!item) throw new Error(`managed component is not present in the update plan: ${key}`);
  return item;
}

function findProvenance(state: ManagedComponentState, key: string): ManagedComponentProvenance | undefined {
  return state.provenance.find((candidate) => componentKey(candidate.kind, candidate.id) === key);
}

function replaceProvenance(state: ManagedComponentState, record: ManagedComponentProvenance): void {
  const key = componentKey(record.kind, record.id);
  state.provenance = state.provenance
    .filter((candidate) => componentKey(candidate.kind, candidate.id) !== key)
    .concat(record)
    .sort(compareKeys);
}

function recordFromItem(
  state: ManagedComponentState,
  item: ManagedComponentPlanItem,
  input: {
    baseRef: string;
    localRef: string;
    upstreamRef: string;
    resolutionState: ManagedComponentResolutionState;
    ownership?: ManagedComponentOwnership;
  },
): ManagedComponentProvenance {
  const existing = findProvenance(state, item.key);
  return {
    schemaVersion: 1,
    id: item.id,
    kind: item.kind,
    ownership: input.ownership ?? existing?.ownership ?? item.ownership,
    sourceBundleId: item.sourceBundleId,
    sourceVersion: item.sourceVersion,
    sourcePath: item.sourcePath ?? existing?.sourcePath ?? '',
    baseHash: input.baseRef,
    baseContentRef: input.baseRef,
    localHash: input.localRef,
    upstreamHash: input.upstreamRef,
    installedAt: existing?.installedAt ?? state.plan.generatedAt,
    updatedAt: state.plan.generatedAt,
    resolutionState: input.resolutionState,
    ...(item.localPath ?? existing?.localPath ? { localPath: item.localPath ?? existing?.localPath } : {}),
  };
}

export function inspectManagedComponentConflict(home: string, componentKeyValue: string): {
  item: ManagedComponentPlanItem;
  base: ComponentTree;
  local: ComponentTree;
  upstream: ComponentTree | null;
} {
  const state = readManagedComponentState(home);
  const item = findPlanItem(state, componentKeyValue);
  if (!item.requiresReview) throw new Error(`managed component does not require review: ${componentKeyValue}`);
  return {
    item,
    base: requireContent(state.content, item.baseContentRef, 'base'),
    local: requireContent(state.content, item.localContentRef, 'local'),
    upstream: item.upstreamContentRef
      ? requireContent(state.content, item.upstreamContentRef, 'upstream')
      : null,
  };
}

export function applySafeManagedComponentItems(input: { home: string; userRoot: string }): {
  applied: string[];
  skipped: string[];
} {
  const state = readManagedComponentState(input.home);
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const item of state.plan.items) {
    if (item.requiresReview || ['conflict', 'preserve-custom', 'detach'].includes(item.action)) {
      skipped.push(item.key);
      continue;
    }

    const existing = findProvenance(state, item.key);
    if (item.action === 'remove-upstream') {
      if (item.localPath) {
        assertCurrentLocalMatches(input.userRoot, item);
        const target = resolveInside(input.userRoot, item.localPath);
        assertNoSymlinkPath(input.userRoot, target);
        rmSync(target, { recursive: true, force: true });
      }
      state.provenance = state.provenance.filter((record) => componentKey(record.kind, record.id) !== item.key);
      applied.push(item.key);
      continue;
    }

    if (item.action === 'merge-clean') {
      const mergedRef = item.mergedContentRef;
      const upstreamRef = item.upstreamContentRef;
      if (!mergedRef || !upstreamRef) throw new Error(`clean merge references are missing: ${item.key}`);
      if (!item.localPath) throw new Error(`clean merge has no visible local path: ${item.key}`);
      assertCurrentLocalMatches(input.userRoot, item);
      writeTree(input.userRoot, item.localPath, requireContent(state.content, mergedRef, 'merged'));
      replaceProvenance(state, recordFromItem(state, item, {
        baseRef: upstreamRef,
        localRef: mergedRef,
        upstreamRef,
        resolutionState: 'merged-clean',
      }));
      applied.push(item.key);
      continue;
    }

    const upstreamRef = item.upstreamContentRef ?? item.upstreamHash;
    if (!upstreamRef) throw new Error(`upstream content reference is missing: ${item.key}`);
    if (item.action === 'install' && item.localPath) {
      const target = resolveInside(input.userRoot, item.localPath);
      if (pathExists(target)) {
        skipped.push(item.key);
        continue;
      }
      writeTree(
        input.userRoot,
        item.localPath,
        requireContent(state.content, upstreamRef, 'upstream'),
        true,
      );
    }
    if (item.action === 'update-clean' && item.localPath) {
      assertCurrentLocalMatches(input.userRoot, item);
      writeTree(input.userRoot, item.localPath, requireContent(state.content, upstreamRef, 'upstream'));
    }
    replaceProvenance(state, recordFromItem(state, item, {
      baseRef: upstreamRef,
      localRef: upstreamRef,
      upstreamRef,
      resolutionState: 'clean',
    }));
    if (item.action !== 'no-change' || !existing) applied.push(item.key);
  }

  writeManagedComponentState(input.home, state);
  refreshManagedComponentPlan({
    home: input.home,
    userRoot: input.userRoot,
    generatedAt: state.plan.generatedAt,
  });
  return { applied, skipped };
}

export function acceptManagedComponentUpstream(input: {
  home: string;
  userRoot: string;
  componentKey: string;
}): void {
  const state = readManagedComponentState(input.home);
  const item = findPlanItem(state, input.componentKey);
  const upstreamRef = item.upstreamContentRef;
  if (!upstreamRef) throw new Error(`upstream content is unavailable: ${input.componentKey}`);
  if (item.localPath) {
    assertCurrentLocalMatches(input.userRoot, item);
    writeTree(input.userRoot, item.localPath, requireContent(state.content, upstreamRef, 'upstream'));
  }
  replaceProvenance(state, recordFromItem(state, item, {
    baseRef: upstreamRef,
    localRef: upstreamRef,
    upstreamRef,
    resolutionState: 'accepted-upstream',
    ownership: 'bundled-managed',
  }));
  writeManagedComponentState(input.home, state);
  refreshManagedComponentPlan({
    home: input.home,
    userRoot: input.userRoot,
    generatedAt: state.plan.generatedAt,
  });
}

export function keepManagedComponentLocal(input: { home: string; userRoot: string; componentKey: string }): void {
  const state = readManagedComponentState(input.home);
  const item = findPlanItem(state, input.componentKey);
  const upstreamRef = item.upstreamContentRef;
  const localRef = item.localContentRef;
  if (!upstreamRef || !localRef) throw new Error(`local/upstream content is unavailable: ${input.componentKey}`);
  assertCurrentLocalMatches(input.userRoot, item);
  replaceProvenance(state, recordFromItem(state, item, {
    baseRef: upstreamRef,
    localRef,
    upstreamRef,
    resolutionState: 'kept-local',
    ownership: 'bundled-managed',
  }));
  writeManagedComponentState(input.home, state);
  refreshManagedComponentPlan({
    home: input.home,
    userRoot: input.userRoot,
    generatedAt: state.plan.generatedAt,
  });
}

export function applyReviewedManagedComponentMerge(input: {
  home: string;
  userRoot: string;
  componentKey: string;
  merged: ComponentTree;
  expectedLocalHash: string;
  expectedUpstreamHash: string;
}): void {
  const state = readManagedComponentState(input.home);
  const item = findPlanItem(state, input.componentKey);
  if (item.localHash !== input.expectedLocalHash || item.upstreamHash !== input.expectedUpstreamHash) {
    throw new Error(`managed component changed since review: ${input.componentKey}`);
  }
  if (!item.localPath) throw new Error(`reviewed merge has no visible local path: ${input.componentKey}`);
  const upstreamRef = item.upstreamContentRef;
  if (!upstreamRef) throw new Error(`upstream content is unavailable: ${input.componentKey}`);
  assertCurrentLocalMatches(input.userRoot, item);
  const mergedRef = putContent(state.content, input.merged);
  writeTree(input.userRoot, item.localPath, input.merged);
  replaceProvenance(state, recordFromItem(state, item, {
    baseRef: upstreamRef,
    localRef: mergedRef,
    upstreamRef,
    resolutionState: 'reviewed-merge',
    ownership: 'bundled-managed',
  }));
  writeManagedComponentState(input.home, state);
  refreshManagedComponentPlan({
    home: input.home,
    userRoot: input.userRoot,
    generatedAt: state.plan.generatedAt,
  });
}

export function detachManagedComponent(input: { home: string; componentKey: string }): void {
  const state = readManagedComponentState(input.home);
  const item = findPlanItem(state, input.componentKey);
  const existing = findProvenance(state, input.componentKey);
  if (!existing) throw new Error(`managed component provenance is unavailable: ${input.componentKey}`);
  replaceProvenance(state, {
    ...existing,
    ownership: 'detached',
    updatedAt: state.plan.generatedAt,
    resolutionState: 'detached',
    sourceBundleId: item.sourceBundleId,
    sourceVersion: item.sourceVersion,
    sourcePath: item.sourcePath ?? existing.sourcePath,
  });
  writeManagedComponentState(input.home, state);
}

export function restoreManagedComponentDefault(input: {
  home: string;
  userRoot: string;
  componentKey: string;
  destination: string;
}): string {
  const state = readManagedComponentState(input.home);
  const item = findPlanItem(state, input.componentKey);
  const upstream = requireContent(state.content, item.upstreamContentRef, 'upstream');
  return writeTree(input.userRoot, input.destination, upstream, true);
}

export function requiredManagedContentBaseRefs(
  provenance: ManagedComponentProvenance[],
  plan: ManagedComponentUpdatePlan,
): string[] {
  const provenanceByKey = mapByKey(provenance, 'provenance');
  const refs = new Set<string>();
  for (const item of plan.items) {
    if (!item.requiresReview) continue;
    const ref = item.baseContentRef ?? provenanceByKey.get(item.key)?.baseContentRef;
    if (ref) refs.add(ref);
  }
  return [...refs].sort((left, right) => left.localeCompare(right));
}

export function migrateLegacyManagedMetadata(input: {
  kind: ManagedComponentKind;
  metadata: LegacyManagedMetadata;
  sourceBundleId: string;
  sourceVersion: string;
}): ManagedComponentProvenance {
  const { metadata } = input;
  if (metadata.version !== 1 || metadata.source !== 'bundled') {
    throw new Error('unsupported legacy managed component metadata');
  }
  assertComponentId(metadata.name);
  return {
    schemaVersion: 1,
    id: metadata.name,
    kind: input.kind,
    ownership: 'bundled-managed',
    sourceBundleId: input.sourceBundleId,
    sourceVersion: input.sourceVersion,
    sourcePath: metadata.sourcePath,
    baseHash: metadata.hash,
    baseContentRef: metadata.hash,
    localHash: metadata.hash,
    upstreamHash: metadata.hash,
    installedAt: metadata.installedAt,
    updatedAt: metadata.updatedAt,
    resolutionState: 'clean',
  };
}
