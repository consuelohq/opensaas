import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applySafeManagedComponentItems,
  buildManagedComponentUpdateState,
  hashComponentTree,
  readManagedComponentState,
  snapshotManagedComponentLocalOverrides,
  writeManagedComponentState,
  type ComponentTree,
  type ManagedComponentLocal,
  type ManagedComponentProvenance,
  type ManagedComponentSource,
} from './managed-components';

export type ManagedComponentProvisionAction = {
  type: 'create_file' | 'seed_skill' | 'seed_tool';
  path: string;
  status: 'planned' | 'created' | 'preserved' | 'updated' | 'skipped';
  message: string;
};

type JsonObject = Record<string, unknown>;

type CanonicalToolEntry = {
  name: string;
  kind?: string;
  source?: string;
  sourcePath?: string;
  category?: string;
  description?: string;
  core?: boolean;
  definition?: JsonObject;
};

type CanonicalToolManifest = {
  tools: CanonicalToolEntry[];
};

type ComponentIndexEntry = JsonObject & {
  id: string;
  kind: 'skill' | 'tool';
  ownership: 'bundled-managed';
  sourcePath: string;
  contentHash: string;
};

type LegacyCustomEntry = {
  id: string;
  kind: 'skill' | 'tool';
  ownership: 'custom';
  legacyPath: string;
  migrationRequired: true;
};

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(CURRENT_DIR, '..', '..');
const SKILLS_ROOT = path.join(PACKAGE_ROOT, 'skills');
const TOOL_MANIFEST_PATH = path.join(PACKAGE_ROOT, 'manifests', 'generated', 'tool.manifest.json');
const SKILL_METADATA_FILE = '.consuelo-skill.json';
const TOOL_METADATA_FILE = '.consuelo-tool.json';

const COMPACT_SKILL_FIELDS = [
  'name',
  'title',
  'description',
  'trigger',
  'entrypoint',
  'load',
  'permission',
  'requiresApproval',
  'status',
  'capabilities',
  'tools',
  'subskills',
  'visibility',
  'distribution',
  'audience',
] as const;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonObject(filePath: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isJsonObject(parsed)) throw new Error(`${filePath}: expected JSON object`);
  return parsed;
}

function packageRelative(filePath: string): string {
  return path.relative(PACKAGE_ROOT, filePath).split(path.sep).join('/');
}

function listDirectories(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function listBundledSkillDirs(): string[] {
  return listDirectories(SKILLS_ROOT)
    .filter((skillDir) => fs.existsSync(path.join(skillDir, 'skill.json')));
}

function collectTextFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === SKILL_METADATA_FILE || entry.name === TOOL_METADATA_FILE) continue;
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...collectTextFiles(filePath));
    else if (entry.isFile()) files.push(filePath);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function treeFromDirectory(root: string): ComponentTree {
  const tree: ComponentTree = {};
  for (const filePath of collectTextFiles(root)) {
    const relativePath = path.relative(root, filePath).split(path.sep).join('/');
    const content = fs.readFileSync(filePath);
    if (content.includes(0)) {
      tree[relativePath] = `base64:${content.toString('base64')}`;
    } else {
      tree[relativePath] = content.toString('utf8');
    }
  }
  return tree;
}

function compactSkill(skill: JsonObject): JsonObject {
  const compact: JsonObject = {};
  for (const field of COMPACT_SKILL_FIELDS) {
    if (field in skill) compact[field] = skill[field];
  }
  return compact;
}

function bundledSkillId(skillDir: string): string {
  const metadata = readJsonObject(path.join(skillDir, 'skill.json'));
  return typeof metadata.name === 'string' && metadata.name.trim()
    ? metadata.name.trim()
    : path.basename(skillDir);
}

function readToolManifest(): CanonicalToolManifest {
  const parsed = JSON.parse(fs.readFileSync(TOOL_MANIFEST_PATH, 'utf8')) as unknown;
  if (!isJsonObject(parsed) || !Array.isArray(parsed.tools)) {
    throw new Error(`${TOOL_MANIFEST_PATH}: expected tools array`);
  }
  const tools = parsed.tools as CanonicalToolEntry[];
  for (const tool of tools) {
    if (!tool || typeof tool.name !== 'string' || !tool.name.trim()) {
      throw new Error(`${TOOL_MANIFEST_PATH}: every tool needs a name`);
    }
  }
  return { tools };
}

function compactTool(tool: CanonicalToolEntry): JsonObject {
  return {
    name: tool.name,
    kind: tool.kind,
    source: tool.source,
    sourcePath: tool.sourcePath,
    category: tool.category,
    description: tool.description,
    core: Boolean(tool.core),
    definition: tool.definition,
  };
}

function runtimeVersion(): string {
  const packageJson = readJsonObject(path.join(PACKAGE_ROOT, 'package.json'));
  return typeof packageJson.version === 'string' && packageJson.version.trim()
    ? packageJson.version.trim()
    : '0.0.0';
}

function runtimeBundleIdentity(upstream: ManagedComponentSource[]): { bundleId: string; version: string } {
  const hash = createHash('sha256');
  for (const component of [...upstream].sort((left, right) =>
    `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`))) {
    hash.update(component.kind);
    hash.update('\0');
    hash.update(component.id);
    hash.update('\0');
    hash.update(hashComponentTree(component.content));
    hash.update('\0');
  }
  return { bundleId: `sha256:${hash.digest('hex')}`, version: runtimeVersion() };
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function toolWrapperScript(tool: CanonicalToolEntry): string {
  const quotedName = shellSingleQuote(tool.name);
  const jsonName = shellSingleQuote(JSON.stringify(tool.name));
  const description = shellSingleQuote(tool.description ?? 'Consuelo OS tool.');
  const runner = tool.kind === 'facade-tool'
    ? `exec bun ./scripts/tool-runner.ts ${quotedName} "$INPUT"`
    : `exec bun ./scripts/os.ts call "$(printf '{"name":%s,"input":%s}' ${jsonName} "$INPUT")"`;
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    `TOOL_NAME=${quotedName}`,
    `TOOL_DESCRIPTION=${description}`,
    'OS_HOME="${CONSUELO_OS_HOME:-${CONSUELO_HOME:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}}"',
    'if [ ! -f "$OS_HOME/package.json" ] || [ ! -f "$OS_HOME/scripts/tool-runner.ts" ]; then',
    '  printf "%s\\n" "error: Consuelo OS package root not found. Set CONSUELO_OS_HOME." >&2',
    '  exit 1',
    'fi',
    'if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then',
    '  printf "%s\\n" "usage: $TOOL_NAME [json-input]"',
    '  printf "%s\\n" ""',
    '  printf "%s\\n" "$TOOL_DESCRIPTION"',
    '  exit 0',
    'fi',
    'if [ "$#" -gt 0 ]; then',
    '  INPUT="$1"',
    'else',
    "  INPUT='{}'",
    'fi',
    'cd "$OS_HOME"',
    runner,
    '',
  ].join('\n');
}

function legacyPlaceholder(kind: 'skill' | 'tool', id: string, legacyPath: string): ManagedComponentLocal {
  return {
    id,
    kind,
    localPath: legacyPath,
    content: {
      'legacy-component.json': `${JSON.stringify({
        schemaVersion: 1,
        kind,
        id,
        classification: 'legacy-hidden-custom',
        migrationRequired: true,
      }, null, 2)}\n`,
    },
  };
}

function readExistingState(home: string): {
  provenance: ManagedComponentProvenance[];
  content: Record<string, ComponentTree>;
} {
  const root = path.join(home, 'components');
  if (!fs.existsSync(path.join(root, 'provenance.json')) || !fs.existsSync(path.join(root, 'update-plan.json'))) {
    return { provenance: [], content: {} };
  }
  const state = readManagedComponentState(home);
  return { provenance: state.provenance, content: state.content };
}

function legacyEntries(home: string): {
  custom: ManagedComponentLocal[];
  skills: LegacyCustomEntry[];
  tools: LegacyCustomEntry[];
  actions: ManagedComponentProvisionAction[];
} {
  const custom: ManagedComponentLocal[] = [];
  const skills: LegacyCustomEntry[] = [];
  const tools: LegacyCustomEntry[] = [];
  const actions: ManagedComponentProvisionAction[] = [];

  for (const skillDir of listDirectories(path.join(home, 'skills'))) {
    if (!fs.existsSync(path.join(skillDir, 'skill.json'))) continue;
    const id = path.basename(skillDir);
    const legacyPath = path.relative(home, skillDir).split(path.sep).join('/');
    custom.push(legacyPlaceholder('skill', id, legacyPath));
    skills.push({ id, kind: 'skill', ownership: 'custom', legacyPath, migrationRequired: true });
    actions.push({
      type: 'seed_skill',
      path: skillDir,
      status: 'preserved',
      message: 'legacy hidden skill preserved as custom for explicit visible-tree migration',
    });
  }

  for (const toolDir of listDirectories(path.join(home, 'tools'))) {
    if (!fs.existsSync(path.join(toolDir, 'tool.json'))) continue;
    const id = path.basename(toolDir);
    const legacyPath = path.relative(home, toolDir).split(path.sep).join('/');
    custom.push(legacyPlaceholder('tool', id, legacyPath));
    tools.push({ id, kind: 'tool', ownership: 'custom', legacyPath, migrationRequired: true });
    actions.push({
      type: 'seed_tool',
      path: toolDir,
      status: 'preserved',
      message: 'legacy hidden tool preserved as custom for explicit visible-tree migration',
    });
  }

  return { custom, skills, tools, actions };
}

export function provisionManagedComponentIndexes(input: {
  home: string;
  selectedSkills: readonly string[];
  dryRun: boolean;
  generatedAt: string;
  userRoot?: string;
}): ManagedComponentProvisionAction[] {
  const actions: ManagedComponentProvisionAction[] = [];
  const upstream: ManagedComponentSource[] = [];
  const runtimeComponents: ManagedComponentSource[] = [];
  const skillEntries: ComponentIndexEntry[] = [];
  const selected = new Set(input.selectedSkills);

  for (const skillDir of listBundledSkillDirs()) {
    const id = bundledSkillId(skillDir);
    const content = treeFromDirectory(skillDir);
    const sourcePath = packageRelative(skillDir);
    const source: ManagedComponentSource = {
      id,
      kind: 'skill',
      sourcePath,
      localPath: path.posix.join('Skills', id),
      content,
    };
    runtimeComponents.push(source);
    if (selected.has(id)) {
      upstream.push(source);
      skillEntries.push({
        id,
        kind: 'skill',
        ownership: 'bundled-managed',
        sourcePath,
        contentHash: hashComponentTree(content),
        ...compactSkill(readJsonObject(path.join(skillDir, 'skill.json'))),
      });
      if (input.dryRun) {
        actions.push({
          type: 'seed_skill',
          path: path.join(input.userRoot ?? path.join(os.homedir(), 'Consuelo'), 'Skills', id),
          status: 'planned',
          message: 'selected managed skill materialization planned in visible Skills',
        });
      }
    }
  }

  const toolEntries: ComponentIndexEntry[] = [];
  const binDir = path.join(input.home, 'bin');
  for (const tool of readToolManifest().tools) {
    const sourcePath = packageRelative(TOOL_MANIFEST_PATH);
    const content = { 'tool.json': `${JSON.stringify(compactTool(tool), null, 2)}\n` };
    const source = { id: tool.name, kind: 'tool' as const, sourcePath, content };
    upstream.push(source);
    runtimeComponents.push(source);
    toolEntries.push({
      id: tool.name,
      kind: 'tool',
      ownership: 'bundled-managed',
      sourcePath,
      contentHash: hashComponentTree(content),
      ...compactTool(tool),
    });

    const wrapperPath = path.join(binDir, tool.name);
    actions.push({
      type: 'seed_tool',
      path: wrapperPath,
      status: input.dryRun ? 'planned' : fs.existsSync(wrapperPath) ? 'updated' : 'created',
      message: 'runtime tool wrapper indexed from immutable bundle',
    });
    if (!input.dryRun) {
      fs.mkdirSync(path.dirname(wrapperPath), { recursive: true });
      fs.writeFileSync(wrapperPath, toolWrapperScript(tool), { mode: 0o755 });
      fs.chmodSync(wrapperPath, 0o755);
    }
  }

  const legacy = legacyEntries(input.home);
  actions.push(...legacy.actions);
  const sourceBundle = runtimeBundleIdentity(runtimeComponents);
  const componentsRoot = path.join(input.home, 'components');
  const skillsIndexPath = path.join(componentsRoot, 'installed-skills.json');
  const toolsIndexPath = path.join(componentsRoot, 'installed-tools.json');
  actions.push(
    {
      type: 'create_file',
      path: skillsIndexPath,
      status: input.dryRun ? 'planned' : 'created',
      message: 'immutable runtime skill selection index written',
    },
    {
      type: 'create_file',
      path: toolsIndexPath,
      status: input.dryRun ? 'planned' : 'created',
      message: 'immutable runtime tool index written',
    },
  );

  if (input.dryRun) return actions;
  fs.mkdirSync(componentsRoot, { recursive: true, mode: 0o700 });
  fs.writeFileSync(skillsIndexPath, `${JSON.stringify({
    schemaVersion: 1,
    kind: 'consuelo-installed-skill-index',
    sourceBundle,
    selected: skillEntries.sort((left, right) => left.id.localeCompare(right.id)),
    legacyCustom: legacy.skills.sort((left, right) => left.id.localeCompare(right.id)),
  }, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(toolsIndexPath, `${JSON.stringify({
    schemaVersion: 1,
    kind: 'consuelo-installed-tool-index',
    sourceBundle,
    components: toolEntries.sort((left, right) => left.id.localeCompare(right.id)),
    legacyCustom: legacy.tools.sort((left, right) => left.id.localeCompare(right.id)),
  }, null, 2)}\n`, { mode: 0o600 });

  const previous = readExistingState(input.home);
  const userRoot = input.userRoot ?? path.join(os.homedir(), 'Consuelo');
  const retainedProvenance = previous.provenance.filter((record) => {
    if (record.ownership !== 'bundled-managed' || !record.localPath) {
      return true;
    }
    return fs.existsSync(path.join(userRoot, record.localPath));
  });
  let state = buildManagedComponentUpdateState({
    generatedAt: input.generatedAt,
    sourceBundle,
    provenance: retainedProvenance,
    retainedContent: previous.content,
    upstream,
    localOverrides: snapshotManagedComponentLocalOverrides(userRoot, previous.provenance, upstream),
    custom: legacy.custom,
  });
  writeManagedComponentState(input.home, state);
  const selectedSkillPlan = new Map(
    state.plan.items
      .filter((item) => item.kind === 'skill' && selected.has(item.id))
      .map((item) => [item.id, item]),
  );
  const applyResult = applySafeManagedComponentItems({
    home: input.home,
    userRoot,
  });
  const appliedKeys = new Set(applyResult.applied);
  const skippedKeys = new Set(applyResult.skipped);
  for (const id of [...selected].sort((left, right) => left.localeCompare(right))) {
    const item = selectedSkillPlan.get(id);
    const pathValue = path.join(userRoot, 'Skills', id);
    if (!item) {
      actions.push({
        type: 'seed_skill',
        path: pathValue,
        status: 'skipped',
        message: 'selected managed skill is unavailable in this runtime',
      });
      continue;
    }
    const applied = appliedKeys.has(item.key);
    actions.push({
      type: 'seed_skill',
      path: pathValue,
      status: item.action === 'install' && applied
        ? 'created'
        : ['update-clean', 'merge-clean'].includes(item.action) && applied
          ? 'updated'
          : skippedKeys.has(item.key) ||
              item.requiresReview ||
              ['conflict', 'detach'].includes(item.action)
            ? 'skipped'
            : 'preserved',
      message: item.action === 'install' && applied
        ? 'selected managed skill materialized in visible Skills'
        : skippedKeys.has(item.key) ||
            item.requiresReview ||
            ['conflict', 'detach'].includes(item.action)
          ? 'selected managed skill preserved for explicit conflict review'
          : 'selected managed skill already present in visible Skills',
    });
  }
  const applied = readManagedComponentState(input.home);
  state = buildManagedComponentUpdateState({
    generatedAt: input.generatedAt,
    sourceBundle,
    provenance: applied.provenance,
    retainedContent: applied.content,
    upstream,
    localOverrides: snapshotManagedComponentLocalOverrides(userRoot, applied.provenance, upstream),
    custom: legacy.custom,
  });
  writeManagedComponentState(input.home, state);
  return actions;
}
