#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs';

function writeStdout(value: string): void {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value: string): void {
  process.stderr.write(`${value}\n`);
}

export type ConsueloReaderValidationResult = {
  ok: boolean;
  missing: string[];
};

export const REQUIRED_READER_MARKERS = [
  '#smooth-wrapper',
  '#smooth-content',
  'window.__readerShell',
  'reader-nav-shell',
  'reader-section-rail',
  'reader-resume',
  'reader-back-to-top',
  'https://consuelohq.com/favicon.svg',
  'name="theme-color" content="#202020"',
  '@media (prefers-color-scheme: dark)',
  '/design-wiki',
] as const;

function markerIsPresent(html: string, marker: string): boolean {
  if (marker.startsWith('#')) {
    const id = marker.slice(1);
    return html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
  }
  return html.includes(marker);
}

export function validateConsueloReaderHtml(html: string): ConsueloReaderValidationResult {
  const missing = REQUIRED_READER_MARKERS.filter((marker) => !markerIsPresent(html, marker));
  return { ok: missing.length === 0, missing };
}

function readArg(name: string): string | null {
  const index = Bun.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  return Bun.argv[index + 1] ?? null;
}

if (import.meta.main) {
  const input = readArg('input') ?? Bun.argv[2];
  if (!input) {
    writeStderr('usage: bun run packages/consuelo-design/scripts/validate-consuelo-reader.ts --input <index.html>');
    process.exit(2);
  }
  if (!existsSync(input)) {
    writeStderr(`missing input: ${input}`);
    process.exit(2);
  }

  const result = validateConsueloReaderHtml(readFileSync(input, 'utf8'));
  if (!result.ok) {
    writeStderr(`Consuelo reader validation failed. Missing: ${result.missing.join(', ')}`);
    process.exit(1);
  }

  writeStdout(JSON.stringify({ ok: true, missing: [] }, null, 2));
}
