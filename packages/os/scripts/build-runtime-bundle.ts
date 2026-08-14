import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  buildRuntimeBundle,
  computeReleaseFingerprint,
  inspectRuntimeBundleArchive,
  verifyRuntimeBundleArchive,
  type RuntimeBundleBuildOptions,
  type RuntimeBundleMigration,
  type RuntimeBundleVendoredSource,
} from './lib/distribution/runtime-bundle';

type ParsedArguments = {
  command: string;
  flags: Map<string, string[]>;
};

function parseArguments(argv: string[]): ParsedArguments {
  const [command = '', ...tokens] = argv;
  const flags = new Map<string, string[]>();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${token}`);
    const key = token.slice(2);
    flags.set(key, [...(flags.get(key) ?? []), value]);
    index += 1;
  }

  return { command, flags };
}

function optionalFlag(parsed: ParsedArguments, name: string): string | undefined {
  return parsed.flags.get(name)?.at(-1);
}

function requiredFlag(parsed: ParsedArguments, name: string): string {
  const value = optionalFlag(parsed, name);
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function repeatedFlag(parsed: ParsedArguments, name: string): string[] | undefined {
  const values = parsed.flags.get(name);
  return values && values.length > 0 ? values : undefined;
}

function parseMigrations(values: string[] | undefined): RuntimeBundleMigration[] | undefined {
  return values?.map((value) => {
    const separator = value.indexOf(':');
    if (separator < 0) return { id: value };
    return {
      id: value.slice(0, separator),
      path: value.slice(separator + 1),
    };
  });
}

function parseVendoredSources(
  values: string[] | undefined,
): RuntimeBundleVendoredSource[] | undefined {
  return values?.map((value) => {
    const separator = value.indexOf('=');
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error(
        '--vendored-source must use archive/path=source/path format',
      );
    }
    return {
      path: value.slice(0, separator),
      sourcePath: value.slice(separator + 1),
    };
  });
}

function buildOptions(parsed: ParsedArguments): RuntimeBundleBuildOptions {
  return {
    architecture: optionalFlag(parsed, 'architecture') ?? process.arch,
    authoritativeToolManifestPaths: repeatedFlag(parsed, 'authoritative-tool-manifest'),
    includePaths: repeatedFlag(parsed, 'include-path'),
    migrations: parseMigrations(repeatedFlag(parsed, 'migration')),
    minimumUpdaterVersion: requiredFlag(parsed, 'minimum-updater-version'),
    outputPath: resolve(requiredFlag(parsed, 'output')),
    platform: optionalFlag(parsed, 'platform') ?? process.platform,
    sourceCommit: requiredFlag(parsed, 'source-commit'),
    sourceRoot: resolve(optionalFlag(parsed, 'source-root') ?? process.cwd()),
    vendoredSources: parseVendoredSources(
      repeatedFlag(parsed, 'vendored-source'),
    ),
    version: requiredFlag(parsed, 'version'),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main(argv: string[]): Promise<void> {
  const parsed = parseArguments(argv);

  if (parsed.command === 'fingerprint') {
    return computeReleaseFingerprint({
      includePaths: repeatedFlag(parsed, 'include-path'),
      sourceRoot: resolve(optionalFlag(parsed, 'source-root') ?? process.cwd()),
      vendoredSources: parseVendoredSources(
        repeatedFlag(parsed, 'vendored-source'),
      ),
    }).then((result) => {
      printJson(result);
    });
  }

  if (parsed.command === 'build') {
    return buildRuntimeBundle(buildOptions(parsed)).then((result) => {
      printJson({
        archiveDigest: result.archiveDigest,
        bundleId: result.manifest.bundleId,
        excludedCounts: result.excludedCounts,
        fileCount: result.manifest.files.length,
        outputPath: result.outputPath,
        releaseFingerprint: result.manifest.releaseFingerprint,
        version: result.manifest.version,
      });
    });
  }

  if (parsed.command === 'verify') {
    const archivePath = resolve(requiredFlag(parsed, 'archive'));
    const archiveBytes = readFileSync(archivePath);
    const manifest = verifyRuntimeBundleArchive(archiveBytes);
    const inspected = inspectRuntimeBundleArchive(archiveBytes);
    printJson({
      archivePath,
      bundleId: manifest.bundleId,
      entryCount: inspected.entries.length,
      fileCount: manifest.files.length,
      releaseFingerprint: manifest.releaseFingerprint,
      valid: true,
      version: manifest.version,
    });
    return Promise.resolve();
  }

  return Promise.reject(
    new Error('usage: build-runtime-bundle.ts <fingerprint|build|verify> [--flag value]'),
  );
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: message, ok: false })}\n`);
    process.exitCode = 1;
  }
}
