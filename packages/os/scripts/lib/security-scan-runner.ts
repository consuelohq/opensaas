import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveConsueloHomeLayout } from './consuelo-home';
import {
  normalizeBunAudit,
  normalizeOsvScan,
  normalizeSemgrepScan,
  normalizeTrivyScan,
  diffSecurityGroups,
  groupSecurityFindings,
  summarizeSecurityFindings,
  type SecurityFinding,
  type SecurityScannerName,
} from './security-scan';

export type SecurityScannerStatus = 'completed' | 'unavailable' | 'failed';

export type SecurityScannerResult = {
  name: SecurityScannerName;
  status: SecurityScannerStatus;
  version?: string;
  durationMs: number;
  exitCode?: number;
  rawReportPath?: string;
  findingCount: number;
  warnings: string[];
  error?: string;
};

export type SecurityScanReport = {
  schemaVersion: 1;
  scannedAt: string;
  repoRoot: string;
  rawDir: string;
  reportPath: string;
  previousReportPath?: string;
  complete: boolean;
  scanners: SecurityScannerResult[];
  summary: ReturnType<typeof summarizeSecurityFindings>;
  uniqueSummary: ReturnType<typeof summarizeSecurityFindings>;
  groups: ReturnType<typeof groupSecurityFindings>;
  delta: ReturnType<typeof diffSecurityGroups>;
  findings: SecurityFinding[];
};

type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
};

type ScannerSpec = {
  name: SecurityScannerName;
  binary: string | null;
  version: string | undefined;
  rawReportPath: string;
  run: (binary: string, rawReportPath: string) => CommandResult;
  parse: (value: unknown) => SecurityFinding[];
  acceptedExitCodes: ReadonlySet<number>;
};

const MAX_DIAGNOSTIC_CHARS = 600;
const DEFAULT_SCANNER_TIMEOUT_MS = 5 * 60 * 1000;

function clampDiagnostic(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= MAX_DIAGNOSTIC_CHARS
    ? compact
    : `${compact.slice(0, MAX_DIAGNOSTIC_CHARS)}…`;
}

function command(
  binary: string,
  args: string[],
  options: { cwd: string; timeoutMs: number },
): CommandResult {
  const startedAt = Date.now();
  const result = spawnSync(binary, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      SEMGREP_SEND_METRICS: 'off',
    },
  });
  return {
    exitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    durationMs: Date.now() - startedAt,
    ...(result.error ? { error: result.error.message } : {}),
  };
}

function candidateWorks(candidate: string): boolean {
  const result = spawnSync(candidate, ['--version'], {
    encoding: 'utf8',
    timeout: 5_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return !result.error && result.status !== null;
}

function resolveBinary(name: SecurityScannerName): string | null {
  const candidates: string[] = [];
  if (name === 'bun-audit') {
    candidates.push(process.execPath, '/opt/homebrew/bin/bun', '/usr/local/bin/bun', 'bun');
  } else if (name === 'osv-scanner') {
    candidates.push('/opt/homebrew/bin/osv-scanner', '/usr/local/bin/osv-scanner', 'osv-scanner');
  } else if (name === 'trivy') {
    candidates.push('/opt/homebrew/bin/trivy', '/usr/local/bin/trivy', 'trivy');
  } else {
    candidates.push(
      path.join(os.homedir(), '.local', 'bin', 'semgrep'),
      '/opt/homebrew/bin/semgrep',
      '/usr/local/bin/semgrep',
      'semgrep',
    );
  }
  for (const candidate of [...new Set(candidates)]) {
    if (candidateWorks(candidate)) return candidate;
  }
  return null;
}

function readVersion(binary: string | null): string | undefined {
  if (!binary) return undefined;
  const result = spawnSync(binary, ['--version'], {
    encoding: 'utf8',
    timeout: 5_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const value = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().split('\n')[0]?.trim();
  return value || undefined;
}

function gitRoot(cwd = process.cwd()): string {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    timeout: 10_000,
  });
  if (result.status !== 0) {
    throw new Error(`security.scan requires a git repository: ${clampDiagnostic(result.stderr ?? '')}`);
  }
  const root = result.stdout.trim();
  if (!root) throw new Error('security.scan could not resolve the current git repository root');
  return path.resolve(root);
}

function scanTimestamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, '-');
}

function writePrivateJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function previousReport(cacheRoot: string, currentRawDir: string): { path: string; groups: ReturnType<typeof groupSecurityFindings> } | undefined {
  if (!fs.existsSync(cacheRoot)) return undefined;
  const candidates = fs.readdirSync(cacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(cacheRoot, entry.name, 'security-scan-report.json'))
    .filter((candidate) => path.dirname(candidate) !== currentRawDir && fs.existsSync(candidate))
    .sort()
    .reverse();
  for (const candidate of candidates) {
    try {
      const value = readJson(candidate);
      if (!value || typeof value !== 'object') continue;
      const groups = (value as { groups?: unknown }).groups;
      if (!Array.isArray(groups)) continue;
      return { path: candidate, groups: groups as ReturnType<typeof groupSecurityFindings> };
    } catch {
      // Ignore corrupt historical reports; the current scan remains authoritative.
    }
  }
  return undefined;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function scannerSpecs(
  repoRoot: string,
  rawDir: string,
  timeoutMs: number,
): ScannerSpec[] {
  const bunBinary = resolveBinary('bun-audit');
  const osvBinary = resolveBinary('osv-scanner');
  const trivyBinary = resolveBinary('trivy');
  const semgrepBinary = resolveBinary('semgrep');

  return [
    {
      name: 'bun-audit',
      binary: bunBinary,
      version: readVersion(bunBinary),
      rawReportPath: path.join(rawDir, 'bun-audit.json'),
      acceptedExitCodes: new Set([0, 1]),
      parse: normalizeBunAudit,
      run: (binary, rawReportPath) => {
        const locks = spawnSync('git', ['ls-files', '**/bun.lock', 'bun.lock'], {
          cwd: repoRoot,
          encoding: 'utf8',
          timeout: 10_000,
        }).stdout?.split('\n').map((value) => value.trim()).filter(Boolean) ?? [];
        const directories = [...new Set(locks.map((lock) => path.dirname(lock)))];
        const audits: Array<{ directory: string; result: unknown }> = [];
        const diagnostics: string[] = [];
        let exitCode = 0;
        let durationMs = 0;
        for (const directory of directories) {
          const cwd = path.join(repoRoot, directory);
          const audit = command(binary, ['audit', '--json'], { cwd, timeoutMs });
          durationMs += audit.durationMs;
          if (audit.stderr.trim()) diagnostics.push(`${directory}: ${clampDiagnostic(audit.stderr)}`);
          if (audit.exitCode !== 0 && audit.exitCode !== 1) exitCode = audit.exitCode ?? 2;
          else if (audit.exitCode === 1 && exitCode === 0) exitCode = 1;
          if (audit.stdout.trim()) {
            try {
              audits.push({ directory, result: JSON.parse(audit.stdout) as unknown });
            } catch (error: unknown) {
              diagnostics.push(`${directory}: invalid Bun audit JSON: ${error instanceof Error ? error.message : String(error)}`);
              exitCode = 2;
            }
          }
        }
        fs.writeFileSync(rawReportPath, `${JSON.stringify({ audits }, null, 2)}\n`, { mode: 0o600 });
        return {
          exitCode,
          stdout: '',
          stderr: diagnostics.join('\n'),
          durationMs,
        };
      },
    },
    {
      name: 'osv-scanner',
      binary: osvBinary,
      version: readVersion(osvBinary),
      rawReportPath: path.join(rawDir, 'osv-scanner.json'),
      acceptedExitCodes: new Set([0, 1]),
      parse: normalizeOsvScan,
      run: (binary, rawReportPath) => command(binary, [
        'scan',
        'source',
        '--recursive',
        '--format',
        'json',
        '--output-file',
        rawReportPath,
        repoRoot,
      ], { cwd: repoRoot, timeoutMs }),
    },
    {
      name: 'trivy',
      binary: trivyBinary,
      version: readVersion(trivyBinary),
      rawReportPath: path.join(rawDir, 'trivy.json'),
      acceptedExitCodes: new Set([0]),
      parse: normalizeTrivyScan,
      run: (binary, rawReportPath) => command(binary, [
        'fs',
        '--scanners',
        'vuln,misconfig,secret',
        '--format',
        'json',
        '--output',
        rawReportPath,
        '--quiet',
        repoRoot,
      ], { cwd: repoRoot, timeoutMs }),
    },
    {
      name: 'semgrep',
      binary: semgrepBinary,
      version: readVersion(semgrepBinary),
      rawReportPath: path.join(rawDir, 'semgrep.json'),
      acceptedExitCodes: new Set([0]),
      parse: normalizeSemgrepScan,
      run: (binary, rawReportPath) => {
        const result = command(binary, [
          'scan',
          '--config',
          'p/security-audit',
          '--metrics=off',
          '--json',
          '--quiet',
          repoRoot,
        ], { cwd: repoRoot, timeoutMs });
        if (result.stdout.trim()) fs.writeFileSync(rawReportPath, result.stdout, { mode: 0o600 });
        return result;
      },
    },
  ];
}

function scannerWarnings(name: SecurityScannerName, payload: unknown): string[] {
  if (name !== 'semgrep' || !payload || typeof payload !== 'object') return [];
  const errors = (payload as { errors?: unknown[] }).errors;
  if (!Array.isArray(errors)) return [];
  return errors.slice(0, 20).map((entry) => {
    if (!entry || typeof entry !== 'object') return clampDiagnostic(String(entry));
    const message = (entry as { message?: unknown }).message;
    return clampDiagnostic(typeof message === 'string' ? message : JSON.stringify(entry));
  });
}

export function runSecurityScan(options: {
  cwd?: string;
  home?: string;
  now?: Date;
  scannerTimeoutMs?: number;
} = {}): SecurityScanReport {
  const now = options.now ?? new Date();
  const repoRoot = gitRoot(options.cwd);
  const layout = resolveConsueloHomeLayout(options.home);
  const cacheRoot = path.join(layout.nodeCacheDir, 'security-scans');
  const rawDir = path.join(cacheRoot, scanTimestamp(now));
  fs.mkdirSync(rawDir, { recursive: true, mode: 0o700 });
  const timeoutMs = options.scannerTimeoutMs ?? DEFAULT_SCANNER_TIMEOUT_MS;
  const scanners: SecurityScannerResult[] = [];
  const findings: SecurityFinding[] = [];

  for (const spec of scannerSpecs(repoRoot, rawDir, timeoutMs)) {
    if (!spec.binary) {
      scanners.push({
        name: spec.name,
        status: 'unavailable',
        durationMs: 0,
        findingCount: 0,
        warnings: [],
        error: `${spec.name} is not installed`,
      });
      continue;
    }

    const result = spec.run(spec.binary, spec.rawReportPath);
    let payload: unknown;
    let parseError: string | undefined;
    try {
      if (!fs.existsSync(spec.rawReportPath)) {
        throw new Error('scanner did not produce its JSON report');
      }
      payload = readJson(spec.rawReportPath);
    } catch (error: unknown) {
      parseError = error instanceof Error ? error.message : String(error);
    }

    const exitCode = result.exitCode ?? undefined;
    const exitAccepted = exitCode !== undefined && spec.acceptedExitCodes.has(exitCode);
    if (result.error || parseError || !exitAccepted) {
      scanners.push({
        name: spec.name,
        status: 'failed',
        ...(spec.version ? { version: spec.version } : {}),
        durationMs: result.durationMs,
        ...(exitCode !== undefined ? { exitCode } : {}),
        ...(fs.existsSync(spec.rawReportPath) ? { rawReportPath: spec.rawReportPath } : {}),
        findingCount: 0,
        warnings: [],
        error: clampDiagnostic(
          result.error ?? parseError ?? result.stderr ?? `unexpected scanner exit ${String(exitCode)}`,
        ),
      });
      continue;
    }

    const scannerFindings = spec.parse(payload);
    const warnings = scannerWarnings(spec.name, payload);
    findings.push(...scannerFindings);
    scanners.push({
      name: spec.name,
      status: 'completed',
      ...(spec.version ? { version: spec.version } : {}),
      durationMs: result.durationMs,
      ...(exitCode !== undefined ? { exitCode } : {}),
      rawReportPath: spec.rawReportPath,
      findingCount: scannerFindings.length,
      warnings,
    });
  }

  const reportPath = path.join(rawDir, 'security-scan-report.json');
  const groups = groupSecurityFindings(findings);
  const previous = previousReport(cacheRoot, rawDir);
  const report: SecurityScanReport = {
    schemaVersion: 1,
    scannedAt: now.toISOString(),
    repoRoot,
    rawDir,
    reportPath,
    ...(previous ? { previousReportPath: previous.path } : {}),
    complete: scanners.every((scanner) => scanner.status === 'completed'),
    scanners,
    summary: summarizeSecurityFindings(findings),
    uniqueSummary: summarizeSecurityFindings(groups.map((group) => ({
      fingerprint: group.key,
      scanner: group.scanners[0]!,
      category: group.category,
      severity: group.severity,
      title: group.title,
    }))),
    groups,
    delta: diffSecurityGroups(groups, previous?.groups ?? []),
    findings: findings.sort((left, right) => (
      left.severity.localeCompare(right.severity)
      || left.category.localeCompare(right.category)
      || left.fingerprint.localeCompare(right.fingerprint)
    )),
  };
  writePrivateJson(reportPath, report);
  return report;
}
