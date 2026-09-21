import { describe, expect, it } from 'vitest';

import {
  normalizeBunAudit,
  normalizeOsvScan,
  normalizeSemgrepScan,
  normalizeTrivyScan,
  groupSecurityFindings,
  diffSecurityGroups,
  summarizeSecurityFindings,
  type SecurityFinding,
} from '../scripts/lib/security-scan';

describe('security scan normalization', () => {
  it('normalizes dependency advisories without conflating scanner failures with findings', () => {
    const bun = normalizeBunAudit({
      vulnerabilities: {
        minimist: [
          {
            id: 'GHSA-test-bun',
            severity: 'high',
            title: 'Prototype pollution',
            package: 'minimist',
            installedVersion: '1.2.5',
            patchedVersions: '>=1.2.8',
          },
        ],
      },
    });
    const osv = normalizeOsvScan({
      results: [
        {
          source: { path: 'bun.lock', type: 'lockfile' },
          packages: [
            {
              package: { name: 'minimist', version: '1.2.5', ecosystem: 'npm' },
              vulnerabilities: [
                {
                  id: 'GHSA-test-osv',
                  summary: 'Prototype pollution',
                  database_specific: { severity: 'HIGH' },
                  affected: [{ ranges: [{ events: [{ fixed: '1.2.8' }] }] }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(bun).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scanner: 'bun-audit',
          category: 'dependency',
          severity: 'high',
          advisoryId: 'GHSA-test-bun',
          packageName: 'minimist',
        }),
      ]),
    );
    expect(osv).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scanner: 'osv-scanner',
          category: 'dependency',
          advisoryId: 'GHSA-test-osv',
          packageName: 'minimist',
          fixedVersion: '1.2.8',
        }),
      ]),
    );
    expect(bun[0]?.fingerprint).toMatch(/^sec_[a-f0-9]{16}$/);
    expect(osv[0]?.fingerprint).toMatch(/^sec_[a-f0-9]{16}$/);
  });

  it('accepts Bun audit native package-key JSON and groups overlapping scanner evidence', () => {
    const bun = normalizeBunAudit({
      hono: [{
        id: 1130733,
        url: 'https://github.com/advisories/GHSA-8j4g-w8fx-2239',
        title: 'Hono: ReDoS in CORS middleware via Access-Control-Request-Headers',
        severity: 'moderate',
        vulnerable_versions: '<4.12.34',
      }],
    });
    expect(bun[0]).toMatchObject({
      packageName: 'hono',
      advisoryId: 'GHSA-8j4g-w8fx-2239',
      severity: 'medium',
    });

    const duplicated = [
      ...bun,
      { ...bun[0]!, fingerprint: 'sec_other', scanner: 'osv-scanner' as const },
    ];
    const groups = groupSecurityFindings(duplicated);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.scanners.sort()).toEqual(['bun-audit', 'osv-scanner']);
  });

  it('reports stable daily new, persistent, and resolved group deltas', () => {
    const current = [
      { key: 'a' },
      { key: 'b' },
    ] as ReturnType<typeof groupSecurityFindings>;
    const previous = [
      { key: 'b' },
      { key: 'c' },
    ] as ReturnType<typeof groupSecurityFindings>;
    expect(diffSecurityGroups(current, previous)).toEqual({
      newGroupKeys: ['a'],
      persistentGroupKeys: ['b'],
      resolvedGroupKeys: ['c'],
    });
  });

  it('normalizes Trivy vulnerability, secret, and misconfiguration results', () => {
    const findings = normalizeTrivyScan({
      Results: [
        {
          Target: 'package.json',
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2099-0001',
              PkgName: 'example',
              InstalledVersion: '1.0.0',
              FixedVersion: '1.0.1',
              Severity: 'CRITICAL',
              Title: 'Example vulnerability',
            },
          ],
          Secrets: [
            {
              RuleID: 'private-key',
              Category: 'Private Key',
              Severity: 'HIGH',
              Title: 'Private key detected',
              StartLine: 7,
              EndLine: 11,
            },
          ],
          Misconfigurations: [
            {
              ID: 'AVD-CFG-0001',
              Type: 'Dockerfile Security Check',
              Title: 'Unsafe container setting',
              Severity: 'MEDIUM',
              CauseMetadata: { StartLine: 3, EndLine: 3 },
            },
          ],
        },
      ],
    });

    expect(findings.map((finding) => finding.category).sort()).toEqual([
      'dependency',
      'misconfiguration',
      'secret',
    ]);
  });

  it('normalizes Semgrep source findings and produces a deterministic severity summary', () => {
    const findings = normalizeSemgrepScan({
      results: [
        {
          check_id: 'typescript.lang.security.audit.example',
          path: 'src/example.ts',
          start: { line: 12 },
          end: { line: 12 },
          extra: {
            message: 'Unsafe call',
            severity: 'ERROR',
            metadata: { confidence: 'HIGH' },
          },
        },
      ],
      errors: [],
    });

    expect(findings).toEqual([
      expect.objectContaining({
        scanner: 'semgrep',
        category: 'static',
        severity: 'high',
        ruleId: 'typescript.lang.security.audit.example',
        path: 'src/example.ts',
        startLine: 12,
      }),
    ]);

    const extra: SecurityFinding = {
      ...findings[0]!,
      fingerprint: 'sec_extra',
      severity: 'low',
    };
    expect(summarizeSecurityFindings([...findings, extra])).toMatchObject({
      total: 2,
      critical: 0,
      high: 1,
      medium: 0,
      low: 1,
      unknown: 0,
    });
  });
});
