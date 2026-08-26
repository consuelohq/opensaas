import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';

export const RUNTIME_BUNDLE_SCHEMA_VERSION = 1 as const;
export const RUNTIME_BUNDLE_POLICY_VERSION = 1 as const;
export const RUNTIME_BUNDLE_MANIFEST_PATH = 'runtime-bundle.manifest.json';
export const REQUIRED_RUNTIME_RECOVERY_CAPABILITIES = [
  'caddy-worker-pool',
  'canonical-watchdog',
  'public-connector-readiness',
  'stateless-mcp-2026',
  'supervised-worker-pool',
] as const;
export type RuntimeRecoveryCapability =
  (typeof REQUIRED_RUNTIME_RECOVERY_CAPABILITIES)[number];
export const RUNTIME_BUNDLE_BUILDER_ENTRYPOINT =
  'scripts/build-runtime-bundle.ts';
export const RUNTIME_BUNDLE_INTEGRATION_SCRIPT_KEYS = {
  build: 'runtime-bundle:build',
  fingerprint: 'runtime-bundle:fingerprint',
  verify: 'runtime-bundle:verify',
} as const;

export const RUNTIME_BUNDLE_CONTENT_ROLES = [
  'runtime',
  'managed-skill',
  'managed-tool',
  'managed-site-template',
  'platform-adapter',
  'customer-provider',
  'operator-only',
  'test-only',
  'source-only',
] as const;

export type RuntimeBundleContentRole =
  (typeof RUNTIME_BUNDLE_CONTENT_ROLES)[number];
export type RuntimeBundleIncludedRole = Exclude<
  RuntimeBundleContentRole,
  'operator-only' | 'source-only' | 'test-only'
>;

export type RuntimeBundleFile = {
  digest: string;
  mode: number;
  path: string;
  role: RuntimeBundleIncludedRole;
  size: number;
};

export type RuntimeBundleMigration = {
  id: string;
  path?: string;
};

export type RuntimeBundleManifest = {
  architecture: string;
  bundleId: string;
  capabilities?: RuntimeRecoveryCapability[];
  files: RuntimeBundleFile[];
  kind: 'consuelo-runtime-bundle';
  migrations: RuntimeBundleMigration[];
  minimumUpdaterVersion: string;
  platform: string;
  policyVersion: 1;
  provenance: {
    builder: '@consuelo/os/runtime-bundle';
    builderVersion: 1;
    reproducible: true;
    source: 'classified-source-tree';
  };
  releaseFingerprint: string;
  schemaVersion: 1;
  signature: {
    algorithm: 'ed25519';
    format: 'detached';
    signedFields: string[];
  };
  sourceCommit: string;
  version: string;
};

const RUNTIME_RECOVERY_CAPABILITY_FILES: Readonly<
  Record<RuntimeRecoveryCapability, readonly string[]>
> = {
  'stateless-mcp-2026': [
    'scripts/lib/mcp-protocol.ts',
    'scripts/lib/mcp-gateway.ts',
    'scripts/server/routes/mcp.ts',
  ],
  'supervised-worker-pool': [
    'scripts/server/supervisor.ts',
    'scripts/lib/worker-pool.ts',
  ],
  'caddy-worker-pool': [
    'scripts/lib/security-gateway.ts',
    'scripts/consuelo-reload.js',
  ],
  'canonical-watchdog': [
    'scripts/workspace-watchdog.sh',
    'scripts/consuelo-reload.js',
  ],
  'public-connector-readiness': [
    'scripts/lib/lifecycle/connector-readiness.ts',
    'scripts/workspace-node-heartbeat.ts',
    'scripts/lib/workspace-node-heartbeat-client.ts',
  ],
};

export function runtimeRecoveryCapabilitiesForFiles(
  files: Pick<RuntimeBundleFile, 'path'>[],
): RuntimeRecoveryCapability[] {
  const paths = new Set(files.map((file) => file.path));
  return REQUIRED_RUNTIME_RECOVERY_CAPABILITIES.filter((capability) =>
    RUNTIME_RECOVERY_CAPABILITY_FILES[capability].every((filePath) =>
      paths.has(filePath),
    ),
  );
}

export function missingRequiredRuntimeRecoveryCapabilities(
  capabilities: readonly string[] | undefined,
): RuntimeRecoveryCapability[] {
  const available = new Set(capabilities ?? []);
  return REQUIRED_RUNTIME_RECOVERY_CAPABILITIES.filter(
    (capability) => !available.has(capability),
  );
}

export type RuntimeBundleBuildOptions = {
  architecture: string;
  authoritativeToolManifestPaths?: string[];
  includePaths?: string[];
  migrations?: RuntimeBundleMigration[];
  minimumUpdaterVersion: string;
  outputPath?: string;
  platform: string;
  sourceCommit: string;
  sourceRoot: string;
  vendoredSources?: RuntimeBundleVendoredSource[];
  version: string;
};

export type RuntimeBundleVendoredSource = {
  path: string;
  sourcePath: string;
};

export type RuntimeBundleFingerprintOptions = {
  includePaths?: string[];
  sourceRoot: string;
  vendoredSources?: RuntimeBundleVendoredSource[];
};

export type RuntimeBundleArchiveEntry = {
  bytes: Buffer;
  mode: number;
  path: string;
};

export type RuntimeBundleBuildResult = {
  archiveBytes: Buffer;
  archiveDigest: string;
  excludedCounts: Record<'operator-only' | 'source-only' | 'test-only', number>;
  manifest: RuntimeBundleManifest;
  outputPath?: string;
};

const REQUIRED_RUNTIME_INPUTS = [
  'package.json',
  'bun.lock',
  'scripts/os.ts',
  'scripts/native-lifecycle-operation.ts',
  'scripts/retire-legacy-system-daemons.sh',
  'scripts/server/main.ts',
  'scripts/server/supervisor.ts',
  'scripts/lib/install-state.ts',
  'scripts/managed-components.ts',
  'scripts/lib/managed-components.ts',
  'scripts/lib/managed-component-install.ts',
  'scripts/lib/subagent/runner.ts',
  'manifests/generated/tool.manifest.json',
  'manifests/generated/core.manifest.json',
  'hooks/dispatcher.js',
  'steering/system_prompt.md',
  'streams/tools/AGENTS.md',
  'streams/dialer/AGENTS.md',
  'skills/task/SKILL.md',
  'skills/task/skill.json',
] as const;

const DEFAULT_DISCOVERY_PATHS = [
  'package.json',
  'bun.lock',
  'assets/consuelo-mark.png',
  'assets/vendor/observability-traces-v38',
  'scripts',
  'src',
  'tools',
  'manifests',
  'workflows',
  'hooks',
  'native',
  'skills',
  'steering',
  'streams',
  'operator',
  'cloudflare',
  'tests',
] as const;

const OPERATOR_ONLY_FILES = new Set([
  'scripts/migrate-managed-os-mcp-origin-class.ts',
  'scripts/provision-managed-os-mcp-ingress-policy.ts',
  'scripts/seed-workspace-edge-route.ts',
  'scripts/smoke-workspace-edge.ts',
  'scripts/website-deploy.js',
  'scripts/lib/device-authority-release-readiness.ts',
  'scripts/lib/install-edge-site-publisher.ts',
  'scripts/lib/managed-os-mcp-origin-class-migration.ts',
  'scripts/lib/platform-cloudflare-provisioning.ts',
  'scripts/lib/workspace-cloudflare-d1-route-registry.ts',
  'scripts/lib/workspace-cloudflare-edge-router.ts',
  'scripts/lib/workspace-cloudflare-gateway.ts',
  'scripts/lib/workspace-cloudflare-provisioning.ts',
  'scripts/lib/workspace-edge-beta-smoke.ts',
  'scripts/lib/workspace-edge-route-seed.ts',
]);

const PLATFORM_ADAPTER_FILES = new Set([
  'scripts/bootstrap.ps1',
  'scripts/bootstrap.sh',
  'scripts/generate-system-daemons.sh',
  'scripts/install-system-daemons.sh',
  'scripts/retire-legacy-system-daemons.sh',
  'scripts/install.ts',
  'scripts/windows-platform.ts',
  'scripts/lib/windows-platform.ts',
  'scripts/start-consuelo-daemon.sh',
  'scripts/start-portless-daemon.sh',
  'scripts/uninstall-system-daemons.sh',
  'scripts/workspace-watchdog.sh',
]);

const SOURCE_ONLY_FILES = new Set([
  RUNTIME_BUNDLE_BUILDER_ENTRYPOINT,
  'scripts/check-syntax.js',
  'scripts/export-chats.py',
  'scripts/generate-docs.ts',
  'scripts/generate-skills-registry.ts',
  'scripts/generate-tool-manifest.ts',
  'scripts/generate-types.ts',
  'scripts/prepare-release-publication.ts',
  'scripts/release-channels.ts',
  'scripts/railway-logs.js',
  'scripts/railway-redeploy.js',
]);

const CUSTOMER_PROVIDER_FILES = new Set([
  'tools/deployment-provider/errors.ts',
  'tools/deployment-provider/facade.ts',
  'tools/deployment-provider/process.ts',
  'tools/deployment-provider/redaction.ts',
  'tools/deployment-provider/schema.ts',
  'tools/deployment-provider/service.ts',
  'tools/deployment-provider/types.ts',
  'tools/deployment-provider/vercel.ts',
  'tools/deployment-provider/cloudflare-runner.ts',
  'tools/deployment-provider/cloudflare.ts',
  'tools/railway/adapter.ts',
  'tools/railway/cli.ts',
  'tools/railway/service.ts',
]);

const CUSTOMER_PROVIDER_PREFIXES = [
  'scripts/browser',
  'scripts/github',
  'scripts/linear',
  'scripts/sentry',
  'scripts/lib/app-files-client',
  'scripts/lib/connector-origin-hostname',
  'scripts/lib/github',
  'scripts/lib/graphql-client',
  'scripts/lib/workspace-connector-transport',
] as const;

const MANAGED_SITE_PREFIXES = [
  'scripts/artifact-render',
  'scripts/artifact-validate',
  'scripts/artifacts',
  'scripts/design/',
  'scripts/lib/artifacts',
  'scripts/lib/consuelo-sites-',
  'scripts/lib/sites',
  'scripts/lib/trace-sites-',
] as const;

const MANAGED_TOOL_PREFIXES = [
  'scripts/tool-runner',
  'scripts/tools-search',
  'scripts/lib/facade/',
  'scripts/lib/manifest',
  'scripts/lib/tool-scope-authorization',
] as const;

const EXCLUDED_ROLES = new Set<RuntimeBundleContentRole>([
  'operator-only',
  'source-only',
  'test-only',
]);

const WINDOWS_SERVICE_HOST_PATH =
  'native/windows-service/bin/Release/Consuelo.Windows.Service.exe';

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.py',
  '.sh',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function normalizeRelativePath(input: string): string {
  const normalized = input.replaceAll('\\', '/').replace(/^\.\//, '');
  if (
    normalized.length === 0 ||
    isAbsolute(input) ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    throw new Error(
      `runtime-bundle path must be relative and traversal-free: ${input}`,
    );
  }
  return normalized;
}

function startsWithAny(value: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

export function classifyRuntimeBundlePath(
  input: string,
): RuntimeBundleContentRole | null {
  const filePath = normalizeRelativePath(input);

  if (filePath.startsWith('operator/') || filePath.startsWith('cloudflare/')) {
    return 'operator-only';
  }
  if (OPERATOR_ONLY_FILES.has(filePath)) return 'operator-only';
  if (
    filePath.startsWith('tests/') ||
    filePath.startsWith('scripts/testing/') ||
    /(^|\/)fixtures?\//.test(filePath) ||
    /(?:^|\.)test\.[^.]+$/.test(filePath) ||
    /^tools\/[^/]+\/testing\.ts$/.test(filePath)
  ) {
    return 'test-only';
  }
  if (CUSTOMER_PROVIDER_FILES.has(filePath)) return 'customer-provider';
  if (filePath === 'steering/decision.md') return 'source-only';
  if (filePath === 'scripts/lib/distribution/runtime-bundle.ts') {
    return 'runtime';
  }
  if (
    filePath.startsWith('scripts/lib/distribution/') ||
    filePath === 'manifests/manifest.config.ts' ||
    filePath.startsWith('manifests/schemas/') ||
    filePath === 'workflows/workflows.ts' ||
    filePath === 'tools/package.ts' ||
    filePath === 'tools/registry.ts' ||
    /^tools\/[^/]+\/[^/]+\.md$/.test(filePath) ||
    /^tools\/[^/]+\/(?:manifest|schema)\.ts$/.test(filePath) ||
    SOURCE_ONLY_FILES.has(filePath)
  ) {
    return 'source-only';
  }
  if (filePath === 'package.json' || filePath === 'bun.lock') return 'runtime';
  if (filePath === 'assets/consuelo-mark.png') return 'runtime';
  if (filePath.startsWith('assets/vendor/observability-traces-v38/')) {
    return 'managed-site-template';
  }
  if (filePath.startsWith('skills/')) return 'managed-skill';
  if (/^tools\/[^/]+\/[^/]+\.ts$/.test(filePath)) return 'managed-tool';
  if (
    filePath.startsWith('manifests/generated/') ||
    filePath.startsWith('workflows/generated/') ||
    filePath.startsWith('src/generated/')
  ) {
    return 'managed-tool';
  }
  if (filePath.startsWith('steering/') || filePath.startsWith('streams/'))
    return 'runtime';
  if (filePath.startsWith('hooks/')) return 'runtime';
  if (filePath.startsWith('native/macos/.build/')) return 'source-only';
  if (filePath.startsWith('native/windows-service/obj/')) {
    return 'source-only';
  }
  if (
    filePath.startsWith('native/windows-service/bin/') &&
    filePath !== WINDOWS_SERVICE_HOST_PATH
  ) {
    return 'source-only';
  }
  if (
    filePath.startsWith('native/windows-service/') ||
    filePath.startsWith('native/macos/')
  ) {
    return 'platform-adapter';
  }
  if (PLATFORM_ADAPTER_FILES.has(filePath)) return 'platform-adapter';
  if (startsWithAny(filePath, CUSTOMER_PROVIDER_PREFIXES))
    return 'customer-provider';
  if (startsWithAny(filePath, MANAGED_SITE_PREFIXES))
    return 'managed-site-template';
  if (startsWithAny(filePath, MANAGED_TOOL_PREFIXES)) return 'managed-tool';
  if (filePath.startsWith('scripts/') || filePath.startsWith('src/'))
    return 'runtime';

  return null;
}

function sha256(bytes: Uint8Array | string): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) output[key] = canonicalize(item);
    }
    return output;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function formattedCanonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function listFilesRecursively(root: string, relativeRoot: string): string[] {
  const absoluteRoot = join(root, relativeRoot);
  if (!existsSync(absoluteRoot)) return [];
  const stat = lstatSync(absoluteRoot);
  if (stat.isSymbolicLink()) {
    throw new Error(
      `runtime-bundle source cannot be a symbolic link: ${relativeRoot}`,
    );
  }
  if (stat.isFile()) return [normalizeRelativePath(relativeRoot)];
  if (!stat.isDirectory()) return [];

  const files: string[] = [];
  for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === '.build'
    )
      continue;
    const child = normalizeRelativePath(`${relativeRoot}/${entry.name}`);
    if (entry.isSymbolicLink()) {
      throw new Error(
        `runtime-bundle source cannot be a symbolic link: ${child}`,
      );
    }
    if (entry.isDirectory()) files.push(...listFilesRecursively(root, child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

function assertRequiredInputs(sourceRoot: string): void {
  for (const requiredPath of REQUIRED_RUNTIME_INPUTS) {
    const absolutePath = join(sourceRoot, requiredPath);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      throw new Error(`required runtime input is missing: ${requiredPath}`);
    }
  }
}

function extensionOf(filePath: string): string {
  const base = filePath.slice(filePath.lastIndexOf('/') + 1);
  const index = base.lastIndexOf('.');
  return index < 0 ? '' : base.slice(index).toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTextFile(filePath: string, bytes: Buffer): boolean {
  if (TEXT_EXTENSIONS.has(extensionOf(filePath))) return true;
  if (bytes.includes(0)) return false;
  return filePath === 'package.json' || filePath === 'bun.lock';
}

function portableFileMode(bytes: Buffer): number {
  return bytes.subarray(0, 2).equals(Buffer.from('#!')) ? 0o755 : 0o644;
}

export function containsMachineSpecificAbsolutePath(
  text: string,
  sourceRoot: string,
): boolean {
  const resolvedRoot =
    sourceRoot.startsWith('/') || /^[A-Za-z]:[\\/]/.test(sourceRoot)
      ? sourceRoot
      : resolve(sourceRoot);
  const normalizedRoot = resolvedRoot.replaceAll('\\', '/');
  const rootCandidates = [...new Set([resolvedRoot, normalizedRoot])];
  const embeddedSourceRoots = rootCandidates.map(
    (candidate) =>
      new RegExp(
        escapeRegExp(candidate) + '(?:\\\\|/|$|[\\s\"\'=,:;(){}\[\]])',
      ),
  );
  if (embeddedSourceRoots.some((pattern) => pattern.test(text))) return true;

  const textWithoutSourceRoot = rootCandidates.reduce(
    (current, candidate) => current.replaceAll(candidate, ''),
    text,
  );
  const machinePathPatterns = [
    /\/Users\/(?!\.\.\.)([A-Za-z0-9_-]+)\//,
    /\/home\/(?!\.\.\.)([A-Za-z0-9_-]+)\//,
    /[A-Za-z]:\\Users\\(?!\.\.\.)([^\\\r\n]+)\\/,
  ];
  return machinePathPatterns.some((pattern) =>
    pattern.test(textWithoutSourceRoot),
  );
}
function portableContent(
  filePath: string,
  bytes: Buffer,
  sourceRoot: string,
): Buffer {
  if (!isTextFile(filePath, bytes)) return bytes;
  const originalText = bytes.toString('utf8');
  const portableText = originalText
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n');
  const isSanitizedDocumentation =
    filePath.startsWith('steering/') && filePath.endsWith('.md');
  const text = isSanitizedDocumentation
    ? portableText
        .replaceAll(/\/Users\/(?!\.\.\.\/)[A-Za-z0-9_-]+\//g, '/Users/.../')
        .replaceAll(
          /[A-Za-z]:\\Users\\(?!\.\.\.\\)[^\\\r\n]+\\/g,
          'C:\\Users\\...\\',
        )
    : portableText;
  if (containsMachineSpecificAbsolutePath(text, sourceRoot)) {
    throw new Error(`machine-specific absolute path found in ${filePath}`);
  }
  const internalHostPatterns = [
    /\bos-dist-[a-z0-9.-]*\.consuelohq\.com\b/i,
    /\blegacy-workspace\.consuelohq\.com\b/i,
    /\b[a-z0-9-]+\.internal\.consuelohq\.com\b/i,
  ];
  if (internalHostPatterns.some((pattern) => pattern.test(text))) {
    throw new Error(`known internal test host found in ${filePath}`);
  }
  return text === originalText ? bytes : Buffer.from(text);
}

type CollectedRuntimeFiles = {
  excludedCounts: RuntimeBundleBuildResult['excludedCounts'];
  files: Array<RuntimeBundleFile & { bytes: Buffer }>;
};

function resolveVendoredSources(
  sourceRoot: string,
  sources: RuntimeBundleVendoredSource[] = [],
): Map<string, string> {
  const resolvedSources = new Map<string, string>();
  for (const source of sources) {
    const archivePath = normalizeRelativePath(source.path);
    if (resolvedSources.has(archivePath)) {
      throw new Error(`duplicate vendored runtime path: ${archivePath}`);
    }
    const sourcePath = resolve(sourceRoot, source.sourcePath);
    if (!existsSync(sourcePath)) {
      throw new Error(
        `vendored runtime source is missing: ${source.sourcePath}`,
      );
    }
    const stat = lstatSync(sourcePath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(
        `vendored runtime source must be a regular file: ${source.sourcePath}`,
      );
    }
    resolvedSources.set(archivePath, sourcePath);
  }
  return resolvedSources;
}

function collectRuntimeFiles(
  input: RuntimeBundleFingerprintOptions,
): CollectedRuntimeFiles {
  const sourceRoot = resolve(input.sourceRoot);
  assertRequiredInputs(sourceRoot);
  const vendoredSources = resolveVendoredSources(
    sourceRoot,
    input.vendoredSources,
  );

  const requestedPaths = input.includePaths
    ? [...new Set(input.includePaths.map(normalizeRelativePath))]
    : DEFAULT_DISCOVERY_PATHS.flatMap((candidate) =>
        listFilesRecursively(sourceRoot, candidate),
      );
  requestedPaths.push(...vendoredSources.keys());
  const paths = [...new Set(requestedPaths)].sort();
  const excludedCounts = {
    'operator-only': 0,
    'source-only': 0,
    'test-only': 0,
  };
  const files: CollectedRuntimeFiles['files'] = [];

  for (const filePath of paths) {
    const role = classifyRuntimeBundlePath(filePath);
    if (!role) throw new Error(`unclassified runtime-bundle path: ${filePath}`);
    if (EXCLUDED_ROLES.has(role)) {
      if (input.includePaths) {
        if (role === 'operator-only') {
          throw new Error(
            `operator-only content cannot enter a runtime bundle: ${filePath}`,
          );
        }
        throw new Error(
          `${role} content cannot enter a runtime bundle: ${filePath}`,
        );
      }
      excludedCounts[role as keyof typeof excludedCounts] += 1;
      continue;
    }

    const absolutePath = vendoredSources.get(filePath) ?? join(sourceRoot, filePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`runtime-bundle input is missing: ${filePath}`);
    }
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(
        `runtime-bundle input must be a regular file: ${filePath}`,
      );
    }
    const bytes = portableContent(
      filePath,
      readFileSync(absolutePath),
      sourceRoot,
    );
    files.push({
      bytes,
      digest: sha256(bytes),
      mode: portableFileMode(bytes),
      path: filePath,
      role: role as RuntimeBundleIncludedRole,
      size: bytes.byteLength,
    });
  }

  const includedPaths = new Set(files.map((file) => file.path));
  for (const requiredPath of REQUIRED_RUNTIME_INPUTS) {
    if (!includedPaths.has(requiredPath)) {
      throw new Error(
        `required runtime input is not included: ${requiredPath}`,
      );
    }
  }

  return { excludedCounts, files };
}

function releaseFingerprintForFiles(files: RuntimeBundleFile[]): string {
  return sha256(
    canonicalJson({
      files: files.map(({ digest, mode, path, role, size }) => ({
        digest,
        mode,
        path,
        role,
        size,
      })),
      policyVersion: RUNTIME_BUNDLE_POLICY_VERSION,
      schemaVersion: RUNTIME_BUNDLE_SCHEMA_VERSION,
    }),
  );
}

export async function computeReleaseFingerprint(
  options: RuntimeBundleFingerprintOptions,
): Promise<{
  excludedCounts: RuntimeBundleBuildResult['excludedCounts'];
  files: RuntimeBundleFile[];
  releaseFingerprint: string;
}> {
  const collected = collectRuntimeFiles(options);
  const files = collected.files.map(({ bytes: _bytes, ...file }) => file);
  return {
    excludedCounts: collected.excludedCounts,
    files,
    releaseFingerprint: releaseFingerprintForFiles(files),
  };
}

function assertSemver(value: string, label: string): void {
  if (!SEMVER_PATTERN.test(value))
    throw new Error(`${label} must be a SemVer value`);
}

function assertBuildOptions(options: RuntimeBundleBuildOptions): void {
  assertSemver(options.version, 'runtime-bundle version');
  assertSemver(options.minimumUpdaterVersion, 'minimum updater version');
  if (!options.platform.trim())
    throw new Error('runtime-bundle platform is required');
  if (!options.architecture.trim())
    throw new Error('runtime-bundle architecture is required');
  if (!options.sourceCommit.trim())
    throw new Error('runtime-bundle source commit is required');
}

function assertAuthoritativeToolManifestsAgree(
  sourceRoot: string,
  manifestPaths: string[],
): void {
  const canonicalManifests = manifestPaths.map((manifestPath) => {
    const normalized = normalizeRelativePath(manifestPath);
    const absolutePath = join(sourceRoot, normalized);
    if (!existsSync(absolutePath)) {
      throw new Error(
        `authoritative customer tool manifest is missing: ${normalized}`,
      );
    }
    try {
      return canonicalJson(JSON.parse(readFileSync(absolutePath, 'utf8')));
    } catch (error: unknown) {
      throw new Error(
        `authoritative customer tool manifest is invalid JSON: ${normalized}`,
        {
          cause: error,
        },
      );
    }
  });
  if (new Set(canonicalManifests).size > 1) {
    throw new Error('authoritative customer tool manifests disagree');
  }
}

function bundleIdentityPayload(
  manifest: Omit<RuntimeBundleManifest, 'bundleId'>,
): unknown {
  return manifest;
}

function bundleIdForManifest(
  manifest: Omit<RuntimeBundleManifest, 'bundleId'>,
): string {
  return sha256(canonicalJson(bundleIdentityPayload(manifest)));
}

function normalizeMigrations(
  migrations: RuntimeBundleMigration[] = [],
): RuntimeBundleMigration[] {
  const normalized = migrations.map((migration) => {
    if (!migration.id.trim())
      throw new Error('runtime-bundle migration id is required');
    return {
      id: migration.id,
      ...(migration.path
        ? { path: normalizeRelativePath(migration.path) }
        : {}),
    };
  });
  normalized.sort((left, right) => left.id.localeCompare(right.id));
  const ids = normalized.map((migration) => migration.id);
  if (new Set(ids).size !== ids.length)
    throw new Error('runtime-bundle migration ids must be unique');
  return normalized;
}

function writeTarString(
  buffer: Buffer,
  value: string,
  offset: number,
  length: number,
): void {
  const bytes = Buffer.from(value);
  if (bytes.byteLength > length)
    throw new Error(`tar field exceeds ${length} bytes: ${value}`);
  bytes.copy(buffer, offset);
}

function writeTarOctal(
  buffer: Buffer,
  value: number,
  offset: number,
  length: number,
): void {
  const encoded = value.toString(8).padStart(length - 1, '0');
  writeTarString(buffer, `${encoded}\0`, offset, length);
}

function splitTarPath(filePath: string): { name: string; prefix: string } {
  if (Buffer.byteLength(filePath) <= 100) return { name: filePath, prefix: '' };
  const segments = filePath.split('/');
  for (let index = segments.length - 1; index > 0; index -= 1) {
    const prefix = segments.slice(0, index).join('/');
    const name = segments.slice(index).join('/');
    if (Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155) {
      return { name, prefix };
    }
  }
  throw new Error(
    `runtime-bundle path is too long for deterministic ustar output: ${filePath}`,
  );
}

function createTarHeader(entry: RuntimeBundleArchiveEntry): Buffer {
  const header = Buffer.alloc(512);
  const pathParts = splitTarPath(entry.path);
  writeTarString(header, pathParts.name, 0, 100);
  writeTarOctal(header, entry.mode & 0o777, 100, 8);
  writeTarOctal(header, 0, 108, 8);
  writeTarOctal(header, 0, 116, 8);
  writeTarOctal(header, entry.bytes.byteLength, 124, 12);
  writeTarOctal(header, 0, 136, 12);
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  writeTarString(header, 'ustar\0', 257, 6);
  writeTarString(header, '00', 263, 2);
  writeTarString(header, 'root', 265, 32);
  writeTarString(header, 'root', 297, 32);
  if (pathParts.prefix) writeTarString(header, pathParts.prefix, 345, 155);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  const encodedChecksum = checksum.toString(8).padStart(6, '0');
  writeTarString(header, `${encodedChecksum}\0 `, 148, 8);
  return header;
}

function createDeterministicTar(entries: RuntimeBundleArchiveEntry[]): Buffer {
  const parts: Buffer[] = [];
  for (const entry of [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    const header = createTarHeader(entry);
    parts.push(header, entry.bytes);
    const remainder = entry.bytes.byteLength % 512;
    if (remainder !== 0) parts.push(Buffer.alloc(512 - remainder));
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}

function readTarString(buffer: Buffer, offset: number, length: number): string {
  const end = buffer.indexOf(0, offset);
  const boundedEnd =
    end >= offset && end < offset + length ? end : offset + length;
  return buffer.subarray(offset, boundedEnd).toString('utf8').trim();
}

function readTarOctal(buffer: Buffer, offset: number, length: number): number {
  const value = readTarString(buffer, offset, length)
    .replaceAll('\0', '')
    .trim();
  return value ? Number.parseInt(value, 8) : 0;
}

function parseDeterministicTar(tarBytes: Buffer): RuntimeBundleArchiveEntry[] {
  const entries: RuntimeBundleArchiveEntry[] = [];
  let offset = 0;
  while (offset + 512 <= tarBytes.byteLength) {
    const header = tarBytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const filePath = prefix ? `${prefix}/${name}` : name;
    const mode = readTarOctal(header, 100, 8) & 0o777;
    const size = readTarOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || '0'.charCodeAt(0));
    if (type !== '0' && type !== '\0') {
      throw new Error(
        `runtime-bundle archive contains unsupported tar entry type ${type}: ${filePath}`,
      );
    }
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > tarBytes.byteLength) {
      throw new Error(`runtime-bundle archive is truncated at ${filePath}`);
    }
    entries.push({
      bytes: Buffer.from(tarBytes.subarray(dataStart, dataEnd)),
      mode,
      path: normalizeRelativePath(filePath),
    });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function archiveEntriesFromInput(
  input: Buffer | Uint8Array | RuntimeBundleArchiveEntry[],
): RuntimeBundleArchiveEntry[] {
  if (Array.isArray(input)) {
    return input.map((entry) => ({
      bytes: Buffer.from(entry.bytes),
      mode: entry.mode,
      path: normalizeRelativePath(entry.path),
    }));
  }
  const compressed = Buffer.from(input);
  return parseDeterministicTar(gunzipSync(compressed));
}

export function inspectRuntimeBundleArchive(
  archiveBytes: Buffer | Uint8Array,
): { entries: RuntimeBundleArchiveEntry[]; manifest: RuntimeBundleManifest } {
  const entries = archiveEntriesFromInput(archiveBytes);
  const manifestEntry = entries.find(
    (entry) => entry.path === RUNTIME_BUNDLE_MANIFEST_PATH,
  );
  if (!manifestEntry)
    throw new Error(
      `runtime bundle archive is missing ${RUNTIME_BUNDLE_MANIFEST_PATH}`,
    );
  let manifest: RuntimeBundleManifest;
  try {
    manifest = JSON.parse(
      manifestEntry.bytes.toString('utf8'),
    ) as RuntimeBundleManifest;
  } catch (error: unknown) {
    throw new Error('runtime bundle manifest is invalid JSON', {
      cause: error,
    });
  }
  return { entries, manifest };
}

function assertManifestShape(manifest: RuntimeBundleManifest): void {
  if (manifest.schemaVersion !== RUNTIME_BUNDLE_SCHEMA_VERSION) {
    throw new Error(
      `unsupported runtime bundle schema version: ${String(manifest.schemaVersion)}`,
    );
  }
  if (manifest.policyVersion !== RUNTIME_BUNDLE_POLICY_VERSION) {
    throw new Error(
      `unsupported runtime bundle policy version: ${String(manifest.policyVersion)}`,
    );
  }
  if (manifest.kind !== 'consuelo-runtime-bundle')
    throw new Error('invalid runtime bundle kind');
  if (!Array.isArray(manifest.files))
    throw new Error('runtime bundle manifest files must be an array');
  if (!Array.isArray(manifest.migrations))
    throw new Error('runtime bundle manifest migrations must be an array');
  if (manifest.capabilities !== undefined) {
    if (!Array.isArray(manifest.capabilities)) {
      throw new Error('runtime bundle manifest capabilities must be an array');
    }
    const allowed = new Set<string>(REQUIRED_RUNTIME_RECOVERY_CAPABILITIES);
    const sorted = [...manifest.capabilities].sort();
    if (
      manifest.capabilities.some((capability) => !allowed.has(capability)) ||
      new Set(manifest.capabilities).size !== manifest.capabilities.length ||
      sorted.some((capability, index) => capability !== manifest.capabilities![index])
    ) {
      throw new Error('runtime bundle manifest capabilities are invalid');
    }
  }
  assertSemver(manifest.version, 'runtime-bundle version');
  assertSemver(manifest.minimumUpdaterVersion, 'minimum updater version');
}

export function verifyRuntimeBundleArchive(
  input: Buffer | Uint8Array | RuntimeBundleArchiveEntry[],
): RuntimeBundleManifest {
  const entries = archiveEntriesFromInput(input);
  const duplicatePaths = entries
    .map((entry) => entry.path)
    .filter((filePath, index, paths) => paths.indexOf(filePath) !== index);
  if (duplicatePaths.length > 0) {
    throw new Error(
      `runtime bundle archive contains duplicate path: ${duplicatePaths[0]}`,
    );
  }
  const manifestEntry = entries.find(
    (entry) => entry.path === RUNTIME_BUNDLE_MANIFEST_PATH,
  );
  if (!manifestEntry)
    throw new Error(
      `runtime bundle archive is missing ${RUNTIME_BUNDLE_MANIFEST_PATH}`,
    );
  let manifest: RuntimeBundleManifest;
  try {
    manifest = JSON.parse(
      manifestEntry.bytes.toString('utf8'),
    ) as RuntimeBundleManifest;
  } catch (error: unknown) {
    throw new Error('runtime bundle manifest is invalid JSON', {
      cause: error,
    });
  }
  assertManifestShape(manifest);

  const payloadEntries = new Map(
    entries
      .filter((entry) => entry.path !== RUNTIME_BUNDLE_MANIFEST_PATH)
      .map((entry) => [entry.path, entry]),
  );
  const expectedPaths = new Set(manifest.files.map((file) => file.path));

  for (const file of manifest.files) {
    const entry = payloadEntries.get(file.path);
    if (!entry)
      throw new Error(`runtime bundle archive is missing ${file.path}`);
    if (entry.mode !== file.mode)
      throw new Error(`runtime bundle mode mismatch for ${file.path}`);
    if (
      entry.bytes.byteLength !== file.size ||
      sha256(entry.bytes) !== file.digest
    ) {
      throw new Error(`runtime bundle digest mismatch for ${file.path}`);
    }
  }
  for (const filePath of payloadEntries.keys()) {
    if (!expectedPaths.has(filePath)) {
      throw new Error(
        `runtime bundle archive contains unlisted file: ${filePath}`,
      );
    }
  }

  const expectedFingerprint = releaseFingerprintForFiles(manifest.files);
  if (manifest.releaseFingerprint !== expectedFingerprint) {
    throw new Error(
      'runtime bundle release fingerprint does not match its file inventory',
    );
  }
  const { bundleId, ...manifestWithoutBundleId } = manifest;
  if (bundleIdForManifest(manifestWithoutBundleId) !== bundleId) {
    throw new Error('runtime bundle ID does not match its manifest content');
  }
  return manifest;
}

export async function buildRuntimeBundle(
  options: RuntimeBundleBuildOptions,
): Promise<RuntimeBundleBuildResult> {
  assertBuildOptions(options);
  const sourceRoot = resolve(options.sourceRoot);
  assertAuthoritativeToolManifestsAgree(
    sourceRoot,
    options.authoritativeToolManifestPaths ?? [
      'manifests/generated/tool.manifest.json',
    ],
  );
  const collected = collectRuntimeFiles({
    sourceRoot,
    ...(options.includePaths ? { includePaths: options.includePaths } : {}),
    ...(options.vendoredSources
      ? { vendoredSources: options.vendoredSources }
      : {}),
  });
  const files = collected.files.map(({ bytes: _bytes, ...file }) => file);
  const releaseFingerprint = releaseFingerprintForFiles(files);
  const capabilities = runtimeRecoveryCapabilitiesForFiles(files);
  const manifestWithoutBundleId: Omit<RuntimeBundleManifest, 'bundleId'> = {
    architecture: options.architecture,
    capabilities,
    files,
    kind: 'consuelo-runtime-bundle',
    migrations: normalizeMigrations(options.migrations),
    minimumUpdaterVersion: options.minimumUpdaterVersion,
    platform: options.platform,
    policyVersion: RUNTIME_BUNDLE_POLICY_VERSION,
    provenance: {
      builder: '@consuelo/os/runtime-bundle',
      builderVersion: 1,
      reproducible: true,
      source: 'classified-source-tree',
    },
    releaseFingerprint,
    schemaVersion: RUNTIME_BUNDLE_SCHEMA_VERSION,
    signature: {
      algorithm: 'ed25519',
      format: 'detached',
      signedFields: [
        'schemaVersion',
        'policyVersion',
        'kind',
        'platform',
        'architecture',
        'capabilities',
        'sourceCommit',
        'version',
        'releaseFingerprint',
        'files',
        'migrations',
        'minimumUpdaterVersion',
        'provenance',
      ],
    },
    sourceCommit: options.sourceCommit,
    version: options.version,
  };
  const manifest: RuntimeBundleManifest = {
    ...manifestWithoutBundleId,
    bundleId: bundleIdForManifest(manifestWithoutBundleId),
  };
  const manifestBytes = Buffer.from(formattedCanonicalJson(manifest));
  const archiveEntries: RuntimeBundleArchiveEntry[] = [
    { bytes: manifestBytes, mode: 0o644, path: RUNTIME_BUNDLE_MANIFEST_PATH },
    ...collected.files.map((file) => ({
      bytes: file.bytes,
      mode: file.mode,
      path: file.path,
    })),
  ];
  const tarBytes = createDeterministicTar(archiveEntries);
  const archiveBytes = gzipSync(tarBytes, { level: 9 });
  verifyRuntimeBundleArchive(archiveBytes);
  const archiveDigest = sha256(archiveBytes);

  if (options.outputPath) {
    const outputPath = resolve(options.outputPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, archiveBytes);
  }

  return {
    archiveBytes,
    archiveDigest,
    excludedCounts: collected.excludedCounts,
    manifest,
    ...(options.outputPath ? { outputPath: resolve(options.outputPath) } : {}),
  };
}
