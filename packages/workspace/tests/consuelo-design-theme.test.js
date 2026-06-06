import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const source = readFileSync(new URL('../scripts/consuelo-design.ts', import.meta.url), 'utf8');

test('keeps the generated design wiki theme and search surfaces styled', () => {
  for (const marker of [
    '--paper:#f8f1e7',
    '--ink:#251d17',
    '@media (prefers-color-scheme: dark)',
    '--paper:#111820',
    '--ink:#e9eef4',
    '.search-input::placeholder',
    '.pagefind-ui__result-excerpt mark',
  ]) {
    expect(source).toContain(marker);
  }
});

test('keeps design wiki page publishes versioned and rollback-safe', () => {
  for (const marker of [
    'type DesignArchivePageVersion = {',
    'type DesignArchivePage = {',
    'version: 2;',
    'pages: Record<string, DesignArchivePage>;',
    'function archiveVersionIdFromDate',
    'function archiveVersionRelativeArtifactPath',
    'function archiveCurrentRelativeArtifactPath',
    'function normalizeArchivePayload',
    'function renderVersionHistoryPage',
    'currentVersionId',
    'previousVersionId',
    'versions: [version, ...previousVersions]',
    'data-version-count',
    'function entryForVersionRoute',
    '/versions/',
    'Archived versions',
  ]) {
    expect(source).toContain(marker);
  }
});
