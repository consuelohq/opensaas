import { describe, expect, it } from 'vitest';

import { parseJsonStdout, runMediaCli } from './helpers';

const commandMatrix = [
  ['doctor', '--json'],
  ['install', '--profile', 'media-core', '--dry-run', '--json'],
  ['probe', '--input', 'fixtures/missing.mp4', '--json'],
  ['frames', 'extract', '--input', 'fixtures/missing.mp4', '--timestamp', '0.1', '--out', 'tmp/media-frames', '--json'],
  ['timeline', 'validate', '--timeline', 'fixtures/missing-timeline.json', '--json'],
  ['compose', '--timeline', 'fixtures/missing-timeline.json', '--out', 'tmp/out.mp4', '--json'],
  ['qa', '--input', 'fixtures/missing-output.mp4', '--json'],
] as const;

describe('media CLI JSON envelope', () => {
  it('supports --json on every core command and never prints required data as unstructured stdout', () => {
    for (const args of commandMatrix) {
      const result = runMediaCli([...args]);
      const stdout = result.stdout.trim();
      const stderr = result.stderr.trim();

      expect(stdout || stderr, 'command should produce structured output: ' + args.join(' ')).toBeTruthy();
      const json = parseJsonStdout(stdout || stderr);
      expect(json.schema, 'command should include schema: ' + args.join(' ')).toMatch(/^media\./);
      expect(json.ok, 'command should include ok boolean: ' + args.join(' ')).toEqual(expect.any(Boolean));
      if (result.status !== 0) {
        expect(json.error, 'failed command should include structured error: ' + args.join(' ')).toBeDefined();
      }
    }
  });

  it('returns dependency ids and profiles for missing binary errors', () => {
    const result = runMediaCli(['probe', '--input', 'fixtures/missing.mp4', '--json'], { env: { CONSUELO_MEDIA_TEST_FORCE_MISSING: 'ffprobe' } });
    const json = parseJsonStdout(result.stdout || result.stderr);

    expect(result.status).not.toBe(0);
    expect(json.schema).toBe('media.error.v1');
    expect(JSON.stringify(json)).toContain('ffmpeg');
    expect(JSON.stringify(json)).toContain('ffprobe');
    expect(JSON.stringify(json)).toContain('media-core');
  });
});
