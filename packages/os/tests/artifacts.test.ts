import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  importLegacyArtifactArchive,
  publishArtifact,
  readArtifactCatalog,
  reconcileArtifactCurrentTree,
  rollbackArtifact,
} from '../scripts/lib/artifacts';

let home = '';

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-artifacts-'));
});

afterEach(() => {
  if (home) rmSync(home, { recursive: true, force: true });
  home = '';
});

function writeHtml(name: string, body: string): string {
  const filePath = join(home, name);
  writeFileSync(filePath, `<!doctype html><html><body>${body}</body></html>`, 'utf8');
  return filePath;
}

describe('Consuelo Artifacts', () => {
  it('publishes route-addressed artifacts with immutable versions and a branded site', () => {
    const sourceV1 = writeHtml('source-v1.html', '<h1>Version one</h1>');
    const first = publishArtifact({
      home,
      target: sourceV1,
      path: '/specs/os-artifacts',
      title: 'OS Artifacts',
      category: 'specs',
      template: 'spec',
      traceId: 'trc_artifact_v1',
      skillName: 'artifacts',
      now: '2026-07-15T00:00:00.000Z',
    });

    expect(first.artifact.path).toBe('/specs/os-artifacts');
    expect(first.artifact.currentVersionId).toBe('2026-07-15T00-00-00-000Z');
    expect(first.artifact.versionCount).toBe(1);
    expect(first.version.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(join(home, 'artifacts', 'current', 'specs', 'os-artifacts', 'index.html'))).toBe(true);
    expect(existsSync(join(home, 'artifacts', 'versions', 'specs', 'os-artifacts', first.artifact.currentVersionId, 'index.html'))).toBe(true);

    const siteIndex = join(home, 'sites', 'artifacts', 'index.html');
    expect(existsSync(siteIndex)).toBe(true);
    const html = readFileSync(siteIndex, 'utf8');
    expect(html).toContain('<title>Consuelo Artifacts</title>');
    expect(html).toContain('<meta name="description"');
    expect(html).toContain('<link rel="canonical" href="/artifacts"');
    expect(html).toContain('data-consuelo-logo');
    expect(html).toContain('data-workspace-shell');
    expect(html).toContain('data-workspace-chrome');
    expect(html).toContain('aria-current="page" href="/artifacts"');
    expect(html).toContain('<h1>Artifacts</h1>');
    expect(html).toContain('Recently Updated');
    expect(html).toContain('/artifacts/specs/os-artifacts');

    const sourceV2 = writeHtml('source-v2.html', '<h1>Version two</h1>');
    expect(() => publishArtifact({
      home,
      target: sourceV2,
      path: '/specs/os-artifacts',
      title: 'OS Artifacts',
      category: 'specs',
      template: 'spec',
      now: '2026-07-15T01:00:00.000Z',
    })).toThrow(`base version ${first.artifact.currentVersionId} is required`);

    const second = publishArtifact({
      home,
      target: sourceV2,
      path: '/specs/os-artifacts',
      title: 'OS Artifacts',
      category: 'specs',
      template: 'spec',
      baseVersion: first.artifact.currentVersionId,
      traceId: 'trc_artifact_v2',
      skillName: 'artifacts',
      now: '2026-07-15T01:00:00.000Z',
    });

    expect(second.artifact.currentVersionId).toBe('2026-07-15T01-00-00-000Z');
    expect(second.artifact.versionCount).toBe(2);
    expect(readFileSync(first.version.localPath, 'utf8')).toContain('Version one');
    expect(readFileSync(second.version.localPath, 'utf8')).toContain('Version two');

    const catalog = readArtifactCatalog(home);
    expect(catalog.version).toBe(3);
    expect(catalog.entries).toHaveLength(1);
    expect(catalog.artifacts[first.artifact.id]?.versions).toHaveLength(2);
  });

  it('rolls back by creating a new immutable version', () => {
    const first = publishArtifact({
      home,
      target: writeHtml('rollback-v1.html', '<h1>Rollback one</h1>'),
      path: '/guides/rollback',
      title: 'Rollback Guide',
      category: 'guides',
      template: 'guide',
      now: '2026-07-15T02:00:00.000Z',
    });
    publishArtifact({
      home,
      target: writeHtml('rollback-v2.html', '<h1>Rollback two</h1>'),
      path: '/guides/rollback',
      title: 'Rollback Guide',
      category: 'guides',
      template: 'guide',
      baseVersion: first.artifact.currentVersionId,
      now: '2026-07-15T03:00:00.000Z',
    });

    const rolledBack = rollbackArtifact({
      home,
      artifactId: first.artifact.id,
      versionId: first.artifact.currentVersionId,
      now: '2026-07-15T04:00:00.000Z',
      reason: 'restore approved version',
    });

    expect(rolledBack.artifact.versionCount).toBe(3);
    expect(rolledBack.version.restoredFromVersionId).toBe(first.artifact.currentVersionId);
    expect(readFileSync(rolledBack.version.localPath, 'utf8')).toContain('Rollback one');
  });

  it('rebuilds missing nested current artifacts from immutable current versions', () => {
    const child = publishArtifact({
      home,
      target: writeHtml('repair-child.html', '<h1>Nested child</h1>'),
      path: '/daily-schedules/2026-08-25/self-healing',
      title: 'Nested child',
      category: 'daily-schedule:self-healing-workpad',
      template: 'uncategorized',
      now: '2026-08-26T02:00:00.000Z',
    });
    publishArtifact({
      home,
      target: writeHtml('repair-parent.html', '<h1>Daily Schedules</h1>'),
      path: '/daily-schedules',
      title: 'Daily Schedules',
      category: 'daily-schedules',
      template: 'website',
      now: '2026-08-26T02:01:00.000Z',
    });

    const childCurrent = join(
      home,
      'artifacts',
      'current',
      'daily-schedules',
      '2026-08-25',
      'self-healing',
    );
    rmSync(childCurrent, { recursive: true, force: true });
    expect(existsSync(join(childCurrent, 'index.html'))).toBe(false);

    expect(reconcileArtifactCurrentTree(home)).toBe(2);
    expect(readFileSync(join(childCurrent, 'index.html'), 'utf8')).toContain('Nested child');
    expect(readFileSync(child.version.localPath, 'utf8')).toContain('Nested child');
  });

  it('keeps all Daily Schedules descendants off the main Artifacts index', () => {
    publishArtifact({
      home,
      target: writeHtml('legacy-daily-report.html', '<h1>Legacy daily report</h1>'),
      path: '/daily-schedules/2026-08-17/self-healing-report',
      title: 'Legacy daily report',
      category: 'daily-schedules',
      template: 'uncategorized',
      now: '2026-08-26T02:10:00.000Z',
    });
    publishArtifact({
      home,
      target: writeHtml('daily-index.html', '<h1>Daily Schedules</h1>'),
      path: '/daily-schedules',
      title: 'Daily Schedules',
      category: 'daily-schedules',
      template: 'website',
      now: '2026-08-26T02:11:00.000Z',
    });

    const indexHtml = readFileSync(join(home, 'sites', 'artifacts', 'index.html'), 'utf8');
    expect(indexHtml).toContain('href="/artifacts/daily-schedules"');
    expect(indexHtml).not.toContain(
      'href="/artifacts/daily-schedules/2026-08-17/self-healing-report"',
    );
  });

  it('imports the legacy Office archive once with catalog and file parity', () => {
    const legacyRoot = join(home, 'legacy-office');
    const currentDir = join(legacyRoot, 'artifacts', 'current', 'specs', 'legacy');
    const versionDir = join(legacyRoot, 'artifacts', 'versions', 'specs', 'legacy', '2026-06-01T00-00-00-000Z');
    mkdirSync(currentDir, { recursive: true });
    mkdirSync(versionDir, { recursive: true });
    writeFileSync(join(currentDir, 'index.html'), '<!doctype html><h1>Legacy current</h1>');
    writeFileSync(join(versionDir, 'index.html'), '<!doctype html><h1>Legacy current</h1>');
    writeFileSync(join(legacyRoot, 'archive.json'), JSON.stringify({
      version: 2,
      updatedAt: '2026-06-01T00:00:00.000Z',
      entries: [{
        id: 'legacy-entry',
        pageId: 'legacy-page',
        title: 'Legacy Artifact',
        url: 'https://sites.consuelohq.com/office/specs/legacy',
        directUrl: 'http://100.0.0.1:53935/office/specs/legacy',
        path: '/specs/legacy',
        target: currentDir,
        sourceTarget: '/tmp/legacy.html',
        artifactPath: 'artifacts/current/specs/legacy',
        template: 'spec',
        category: 'specs',
        publishedAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        currentVersionId: '2026-06-01T00-00-00-000Z',
        versionCount: 1,
      }],
      pages: {
        'legacy-page': {
          id: 'legacy-page',
          pageId: 'legacy-page',
          title: 'Legacy Artifact',
          path: '/specs/legacy',
          currentVersionId: '2026-06-01T00-00-00-000Z',
          versions: [{
            id: 'legacy-page:2026-06-01T00-00-00-000Z',
            pageId: 'legacy-page',
            versionId: '2026-06-01T00-00-00-000Z',
            previousVersionId: null,
            title: 'Legacy Artifact',
            url: 'https://sites.consuelohq.com/office/specs/legacy/versions/2026-06-01T00-00-00-000Z',
            directUrl: 'http://100.0.0.1:53935/office/specs/legacy/versions/2026-06-01T00-00-00-000Z',
            path: '/specs/legacy/versions/2026-06-01T00-00-00-000Z',
            target: join(versionDir, 'index.html'),
            sourceTarget: '/tmp/legacy.html',
            artifactPath: 'artifacts/versions/specs/legacy/2026-06-01T00-00-00-000Z',
            template: 'spec',
            category: 'specs',
            publishedAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
          }],
        },
        'orphan-page': {
          id: 'orphan-page',
          pageId: 'orphan-page',
          title: 'Hidden Orphan',
          path: '/specs/hidden-orphan',
          currentVersionId: '2026-05-01T00-00-00-000Z',
          versions: [{
            id: 'orphan-page:2026-05-01T00-00-00-000Z',
            pageId: 'orphan-page',
            versionId: '2026-05-01T00-00-00-000Z',
            previousVersionId: null,
            title: 'Hidden Orphan',
            path: '/specs/hidden-orphan/versions/2026-05-01T00-00-00-000Z',
            target: '/missing/orphan',
            artifactPath: 'artifacts/versions/specs/hidden-orphan/2026-05-01T00-00-00-000Z',
            template: 'spec',
            category: 'specs',
            publishedAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          }],
        },
      },
    }));

    const result = importLegacyArtifactArchive({ home, sourceRoot: legacyRoot });
    expect(result).toMatchObject({
      entries: 1,
      artifacts: 1,
      versions: 1,
      materializedVersions: 1,
      externalVersions: 0,
      files: 2,
      orphanPages: [{
        pageId: 'orphan-page',
        path: '/specs/hidden-orphan',
        reason: 'not-present-in-visible-archive',
      }],
    });
    expect(JSON.parse(readFileSync(result.migrationReportPath, 'utf8')).orphanPages).toHaveLength(1);
    expect(readArtifactCatalog(home).entries[0]?.title).toBe('Legacy Artifact');
    expect(readFileSync(join(home, 'artifacts', 'current', 'specs', 'legacy', 'index.html'), 'utf8')).toContain('Legacy current');
    expect(() => importLegacyArtifactArchive({ home, sourceRoot: legacyRoot })).toThrow('already initialized');
  });
});
