import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const osRoot = resolve(import.meta.dirname, '..');
const excludedDirectories = new Set(['.git', 'coverage', 'dist', 'node_modules']);

function defaultTestSources(directory: string): string[] {
  const sources: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) continue;
      sources.push(...defaultTestSources(path));
      continue;
    }
    if (/\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/.test(entry.name)) sources.push(path);
  }
  return sources.sort();
}

function prohibitedSteeringExamples(): string[] {
  const steering = readFileSync(resolve(osRoot, 'steering', 'system_prompt.md'), 'utf8');
  const heading = '## Absolute safety rule: never execute destructive-literal tests casually.';
  const start = steering.indexOf(heading);
  const end = steering.indexOf('\nThis applies even when the file appears to be testing guardrails.', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return [...steering.slice(start, end).matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]);
}

describe('default OS test source safety', () => {
  it('contains none of the destructive literals prohibited by canonical steering', () => {
    const prohibited = prohibitedSteeringExamples();
    expect(prohibited.length).toBeGreaterThan(0);

    const violations: Array<{ file: string; line: number; rule: number }> = [];
    for (const file of defaultTestSources(osRoot)) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        for (let ruleIndex = 0; ruleIndex < prohibited.length; ruleIndex += 1) {
          if (!lines[lineIndex].includes(prohibited[ruleIndex])) continue;
          violations.push({
            file: relative(osRoot, file),
            line: lineIndex + 1,
            rule: ruleIndex + 1,
          });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
