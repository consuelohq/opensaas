import { createHash } from 'node:crypto';

export type SecurityScannerName = 'bun-audit' | 'osv-scanner' | 'trivy' | 'semgrep';
export type SecurityFindingCategory = 'dependency' | 'static' | 'secret' | 'misconfiguration';
export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export type SecurityFinding = {
  fingerprint: string;
  scanner: SecurityScannerName;
  category: SecurityFindingCategory;
  severity: SecuritySeverity;
  title: string;
  advisoryId?: string;
  ruleId?: string;
  packageName?: string;
  installedVersion?: string;
  fixedVersion?: string;
  path?: string;
  startLine?: number;
  endLine?: number;
  message?: string;
  reference?: string;
};

export type SecurityFindingSummary = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  unknown: number;
  dependency: number;
  static: number;
  secret: number;
  misconfiguration: number;
};

export type SecurityFindingGroup = {
  key: string;
  category: SecurityFindingCategory;
  severity: SecuritySeverity;
  title: string;
  advisoryId?: string;
  ruleId?: string;
  packageName?: string;
  installedVersion?: string;
  path?: string;
  startLine?: number;
  scanners: SecurityScannerName[];
  findingFingerprints: string[];
};

export type SecurityFindingDelta = {
  newGroupKeys: string[];
  persistentGroupKeys: string[];
  resolvedGroupKeys: string[];
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function severity(value: unknown): SecuritySeverity {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high' || normalized === 'error') return 'high';
  if (normalized === 'medium' || normalized === 'moderate' || normalized === 'warning' || normalized === 'warn') return 'medium';
  if (normalized === 'low' || normalized === 'info') return 'low';
  return 'unknown';
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return undefined;
}

function fingerprint(input: Omit<SecurityFinding, 'fingerprint'>): string {
  const stable = [
    input.scanner,
    input.category,
    input.advisoryId ?? '',
    input.ruleId ?? '',
    input.packageName ?? '',
    input.installedVersion ?? '',
    input.path ?? '',
    input.startLine ?? '',
    input.title,
  ].join('\u0000');
  return `sec_${createHash('sha256').update(stable).digest('hex').slice(0, 16)}`;
}

function finding(input: Omit<SecurityFinding, 'fingerprint'>): SecurityFinding {
  return { fingerprint: fingerprint(input), ...input };
}

function fixedVersionFromAffected(value: unknown): string | undefined {
  for (const affected of array(value)) {
    const affectedRecord = record(affected);
    for (const range of array(affectedRecord?.ranges)) {
      const rangeRecord = record(range);
      for (const event of array(rangeRecord?.events)) {
        const fixed = text(record(event)?.fixed);
        if (fixed) return fixed;
      }
    }
  }
  return undefined;
}

export function normalizeBunAudit(payload: unknown): SecurityFinding[] {
  const root = record(payload);
  if (Array.isArray(root?.audits)) {
    return root.audits.flatMap((rawAudit) => {
      const audit = record(rawAudit);
      const directory = text(audit?.directory);
      return normalizeBunAudit(audit?.result).map((item) => ({
        ...item,
        ...(directory && !item.path ? { path: directory } : {}),
      }));
    });
  }
  const vulnerabilities = record(root?.vulnerabilities) ?? root;
  if (!vulnerabilities) return [];
  const findings: SecurityFinding[] = [];

  for (const [packageKey, rawAdvisories] of Object.entries(vulnerabilities)) {
    if (!Array.isArray(rawAdvisories)) continue;
    for (const rawAdvisory of array(rawAdvisories)) {
      const advisory = record(rawAdvisory);
      if (!advisory) continue;
      const advisoryUrl = firstText(advisory.url, advisory.reference);
      const advisoryId = firstText(
        advisory.id,
        advisory.advisoryId,
        advisory.ghsa,
        advisory.cve,
        advisoryUrl?.match(/\/(GHSA-[^/?#]+|CVE-[^/?#]+)$/i)?.[1],
      );
      const packageName = firstText(advisory.package, advisory.module_name, packageKey);
      const title = firstText(advisory.title, advisory.name, advisory.summary, advisoryId, packageName) ?? 'Dependency advisory';
      findings.push(finding({
        scanner: 'bun-audit',
        category: 'dependency',
        severity: severity(advisory.severity),
        title,
        ...(advisoryId ? { advisoryId } : {}),
        ...(packageName ? { packageName } : {}),
        ...(firstText(advisory.installedVersion, advisory.version) ? { installedVersion: firstText(advisory.installedVersion, advisory.version)! } : {}),
        ...(firstText(advisory.fixedVersion, advisory.patchedVersions, advisory.patched_versions) ? { fixedVersion: firstText(advisory.fixedVersion, advisory.patchedVersions, advisory.patched_versions)! } : {}),
        ...(advisoryUrl ? { reference: advisoryUrl } : {}),
      }));
    }
  }
  return findings;
}

export function normalizeOsvScan(payload: unknown): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const rawResult of array(record(payload)?.results)) {
    const result = record(rawResult);
    const sourcePath = text(record(result?.source)?.path);
    for (const rawPackage of array(result?.packages)) {
      const packageResult = record(rawPackage);
      const packageInfo = record(packageResult?.package);
      const packageName = firstText(packageInfo?.name, packageResult?.name);
      const installedVersion = firstText(packageInfo?.version, packageResult?.version);
      for (const rawVulnerability of array(packageResult?.vulnerabilities)) {
        const vulnerability = record(rawVulnerability);
        if (!vulnerability) continue;
        const databaseSpecific = record(vulnerability.database_specific);
        const advisoryId = firstText(vulnerability.id, vulnerability.aliases && array(vulnerability.aliases)[0]);
        const title = firstText(vulnerability.summary, vulnerability.details, advisoryId) ?? 'OSV vulnerability';
        findings.push(finding({
          scanner: 'osv-scanner',
          category: 'dependency',
          severity: severity(databaseSpecific?.severity ?? vulnerability.severity),
          title,
          ...(advisoryId ? { advisoryId } : {}),
          ...(packageName ? { packageName } : {}),
          ...(installedVersion ? { installedVersion } : {}),
          ...(fixedVersionFromAffected(vulnerability.affected) ? { fixedVersion: fixedVersionFromAffected(vulnerability.affected)! } : {}),
          ...(sourcePath ? { path: sourcePath } : {}),
      }));
      }
    }
  }
  return findings;
}

export function normalizeTrivyScan(payload: unknown): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const rawResult of array(record(payload)?.Results ?? record(payload)?.results)) {
    const result = record(rawResult);
    if (!result) continue;
    const target = firstText(result.Target, result.target);

    for (const rawVulnerability of array(result.Vulnerabilities ?? result.vulnerabilities)) {
      const vulnerability = record(rawVulnerability);
      if (!vulnerability) continue;
      const advisoryId = firstText(vulnerability.VulnerabilityID, vulnerability.vulnerabilityId);
      findings.push(finding({
        scanner: 'trivy',
        category: 'dependency',
        severity: severity(vulnerability.Severity ?? vulnerability.severity),
        title: firstText(vulnerability.Title, vulnerability.Description, advisoryId) ?? 'Trivy vulnerability',
        ...(advisoryId ? { advisoryId } : {}),
        ...(firstText(vulnerability.PkgName, vulnerability.packageName) ? { packageName: firstText(vulnerability.PkgName, vulnerability.packageName)! } : {}),
        ...(firstText(vulnerability.InstalledVersion, vulnerability.installedVersion) ? { installedVersion: firstText(vulnerability.InstalledVersion, vulnerability.installedVersion)! } : {}),
        ...(firstText(vulnerability.FixedVersion, vulnerability.fixedVersion) ? { fixedVersion: firstText(vulnerability.FixedVersion, vulnerability.fixedVersion)! } : {}),
        ...(target ? { path: target } : {}),
        ...(firstText(vulnerability.PrimaryURL, vulnerability.reference) ? { reference: firstText(vulnerability.PrimaryURL, vulnerability.reference)! } : {}),
      }));
    }

    for (const rawSecret of array(result.Secrets ?? result.secrets)) {
      const secret = record(rawSecret);
      if (!secret) continue;
      const ruleId = firstText(secret.RuleID, secret.ruleId);
      findings.push(finding({
        scanner: 'trivy',
        category: 'secret',
        severity: severity(secret.Severity ?? secret.severity),
        title: firstText(secret.Title, secret.Category, ruleId) ?? 'Potential secret',
        ...(ruleId ? { ruleId } : {}),
        ...(target ? { path: target } : {}),
        ...(number(secret.StartLine ?? secret.startLine) !== undefined ? { startLine: number(secret.StartLine ?? secret.startLine)! } : {}),
        ...(number(secret.EndLine ?? secret.endLine) !== undefined ? { endLine: number(secret.EndLine ?? secret.endLine)! } : {}),
      }));
    }

    for (const rawMisconfiguration of array(result.Misconfigurations ?? result.misconfigurations)) {
      const misconfiguration = record(rawMisconfiguration);
      if (!misconfiguration) continue;
      const cause = record(misconfiguration.CauseMetadata ?? misconfiguration.causeMetadata);
      const ruleId = firstText(misconfiguration.ID, misconfiguration.id);
      findings.push(finding({
        scanner: 'trivy',
        category: 'misconfiguration',
        severity: severity(misconfiguration.Severity ?? misconfiguration.severity),
        title: firstText(misconfiguration.Title, misconfiguration.Message, ruleId) ?? 'Security misconfiguration',
        ...(ruleId ? { ruleId } : {}),
        ...(target ? { path: target } : {}),
        ...(number(cause?.StartLine ?? cause?.startLine) !== undefined ? { startLine: number(cause?.StartLine ?? cause?.startLine)! } : {}),
        ...(number(cause?.EndLine ?? cause?.endLine) !== undefined ? { endLine: number(cause?.EndLine ?? cause?.endLine)! } : {}),
      }));
    }
  }
  return findings;
}

export function normalizeSemgrepScan(payload: unknown): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const rawResult of array(record(payload)?.results)) {
    const result = record(rawResult);
    if (!result) continue;
    const extra = record(result.extra);
    const metadata = record(extra?.metadata);
    const ruleId = firstText(result.check_id, result.ruleId);
    const path = firstText(result.path);
    const startLine = number(record(result.start)?.line);
    const endLine = number(record(result.end)?.line);
    const title = firstText(extra?.message, metadata?.shortlink, ruleId) ?? 'Semgrep finding';
    findings.push(finding({
      scanner: 'semgrep',
      category: 'static',
      severity: severity(extra?.severity ?? metadata?.severity),
      title,
      ...(ruleId ? { ruleId } : {}),
      ...(path ? { path } : {}),
      ...(startLine !== undefined ? { startLine } : {}),
      ...(endLine !== undefined ? { endLine } : {}),
      ...(firstText(extra?.message) ? { message: firstText(extra?.message)! } : {}),
    }));
  }
  return findings;
}

export function summarizeSecurityFindings(findings: SecurityFinding[]): SecurityFindingSummary {
  const summary: SecurityFindingSummary = {
    total: findings.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
    dependency: 0,
    static: 0,
    secret: 0,
    misconfiguration: 0,
  };
  for (const item of findings) {
    summary[item.severity] += 1;
    summary[item.category] += 1;
  }
  return summary;
}

const severityRank: Record<SecuritySeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  unknown: 1,
};

function groupingTitle(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function groupSecurityFindings(findings: SecurityFinding[]): SecurityFindingGroup[] {
  const groups = new Map<string, SecurityFindingGroup>();
  for (const item of findings) {
    const identity = item.category === 'dependency'
      ? [item.category, item.packageName ?? '', item.installedVersion ?? '', groupingTitle(item.title)].join('|')
      : [item.category, item.ruleId ?? groupingTitle(item.title), item.path ?? '', item.startLine ?? ''].join('|');
    const key = `secgrp_${createHash('sha256').update(identity).digest('hex').slice(0, 16)}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        category: item.category,
        severity: item.severity,
        title: item.title,
        ...(item.advisoryId ? { advisoryId: item.advisoryId } : {}),
        ...(item.ruleId ? { ruleId: item.ruleId } : {}),
        ...(item.packageName ? { packageName: item.packageName } : {}),
        ...(item.installedVersion ? { installedVersion: item.installedVersion } : {}),
        ...(item.path ? { path: item.path } : {}),
        ...(item.startLine !== undefined ? { startLine: item.startLine } : {}),
        scanners: [item.scanner],
        findingFingerprints: [item.fingerprint],
      });
      continue;
    }
    if (severityRank[item.severity] > severityRank[existing.severity]) existing.severity = item.severity;
    if (!existing.advisoryId && item.advisoryId) existing.advisoryId = item.advisoryId;
    if (!existing.ruleId && item.ruleId) existing.ruleId = item.ruleId;
    if (!existing.scanners.includes(item.scanner)) existing.scanners.push(item.scanner);
    existing.findingFingerprints.push(item.fingerprint);
  }
  return [...groups.values()].sort((left, right) => (
    severityRank[right.severity] - severityRank[left.severity]
    || left.category.localeCompare(right.category)
    || left.key.localeCompare(right.key)
  ));
}

export function diffSecurityGroups(
  current: SecurityFindingGroup[],
  previous: SecurityFindingGroup[],
): SecurityFindingDelta {
  const currentKeys = new Set(current.map((group) => group.key));
  const previousKeys = new Set(previous.map((group) => group.key));
  return {
    newGroupKeys: [...currentKeys].filter((key) => !previousKeys.has(key)).sort(),
    persistentGroupKeys: [...currentKeys].filter((key) => previousKeys.has(key)).sort(),
    resolvedGroupKeys: [...previousKeys].filter((key) => !currentKeys.has(key)).sort(),
  };
}
