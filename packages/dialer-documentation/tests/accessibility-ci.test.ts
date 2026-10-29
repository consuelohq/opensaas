import { expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const css = readFileSync(resolve(root, 'src/styles/docs.css'), 'utf8');

function colorHex(hex: string): number[] {
  const channels = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!channels) throw new Error('Invalid opaque CSS hex color: ' + hex);
  return channels.slice(1).map((channel) => parseInt(channel, 16) / 255);
}

function luminance(hex: string): number {
  const [r, g, b] = colorHex(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [higher, lower] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (higher + 0.05) / (lower + 0.05);
}

it('keeps ordinary light-theme muted text above WCAG AA 4.5:1', () => {
  const lightCss = css.match(/:root\[data-theme='light'\]\s*\{([\s\S]*?)\n  \}/)?.[1] ?? '';
  const extract = (key: string): string => {
    const escaped = key.replace(/[.*+?^\\${}()|[\]\\]/g, '\\$&');
    const value = lightCss.match(new RegExp(escaped + ':\\s*(#[0-9a-f]{6})', 'i'))?.[1];
    if (!value) throw new Error('Missing light CSS ' + key);
    return value;
  };
  const contrast = contrastRatio(extract('--docs-muted'), extract('--docs-paper'));
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(extract('--docs-ink'), extract('--docs-paper'))).toBeGreaterThanOrEqual(4.5);
});

it('runs the critical docs browser gate after dependency setup and build', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, '../workspace/test-selection.rules.json'), 'utf8'));
  const rule = manifest.rules.find((value: { id: string }) => value.id === 'dialer-documentation-package');
  expect(rule?.critical).toBe(true);
  const commands = rule.tests.map((suite: { command: string[] }) => suite.command.join(' '));
  const installation = commands.findIndex((cmd: string) => cmd.includes('bun install') && cmd.includes('packages/dialer-documentation'));
  const build = commands.findIndex((cmd: string) => cmd.includes('packages/dialer-documentation') && cmd.endsWith(' build'));
  const lifecycle = commands.findIndex((cmd: string) => cmd.endsWith(' packages/dialer-documentation/scripts/test-preview-lifecycle.mjs'));
  const browser = commands.findIndex((cmd: string) => cmd.includes('packages/dialer-documentation') && cmd.endsWith(' test:browser'));
  expect(installation).toBeGreaterThanOrEqual(0);
  expect(build).toBeGreaterThan(installation);
  expect(lifecycle).toBeGreaterThan(build);
  expect(browser).toBeGreaterThan(lifecycle);
  for (const check of [' test packages/dialer-documentation/tests', ' validate', ' test:translation']) {
    expect(commands.some((cmd: string) => cmd.includes(check))).toBe(true);
  }
});
