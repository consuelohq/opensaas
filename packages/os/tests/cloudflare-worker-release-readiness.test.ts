import { describe, expect, it } from 'vitest';

import {
  assertRequiredCloudflareWorkerSecrets,
  deployCloudflareWorker,
} from '../scripts/lib/cloudflare-worker-release-readiness';

describe('Cloudflare Worker release readiness', () => {
  it('rejects incomplete secret metadata before deployment', async () => {
    const commands: string[][] = [];
    await expect(deployCloudflareWorker({
      target: 'workspace-edge',
      runner: async ({ argv }) => {
        commands.push(argv);
        return {
          exitCode: 0,
          stdout: JSON.stringify([{ name: 'CONSUELO_EDGE_SIGNING_SECRET' }]),
          stderr: '',
        };
      },
    })).rejects.toThrow(
      'Workspace edge secret WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET is not configured',
    );
    expect(commands).toEqual([[
      'wrangler',
      'secret',
      'list',
      '--config',
      'cloudflare/workspace-edge/wrangler.toml',
      '--json',
    ]]);
  });

  it('validates required secrets before issuing deployment', async () => {
    const commands: string[][] = [];
    await deployCloudflareWorker({
      target: 'os-device-authority',
      runner: async ({ argv }) => {
        commands.push(argv);
        return argv[1] === 'secret'
          ? {
              exitCode: 0,
              stdout: JSON.stringify({ secrets: [
                { name: 'CLOUDFLARE_API_TOKEN' },
                { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET' },
              ] }),
              stderr: '',
            }
          : { exitCode: 0, stdout: '', stderr: '' };
      },
    });
    expect(commands[1]).toEqual([
      'wrangler',
      'deploy',
      '--config',
      'cloudflare/os-device-authority/wrangler.toml',
    ]);
  });

  it('rejects malformed metadata without exposing secret values', () => {
    expect(() => assertRequiredCloudflareWorkerSecrets(
      'workspace-edge',
      'not-json',
    )).toThrow('Workspace edge secret list response was not valid JSON');
  });
});
