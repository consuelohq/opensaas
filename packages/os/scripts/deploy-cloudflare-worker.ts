import {
  CLOUDFLARE_WORKER_RELEASE_CONFIGS,
  deployCloudflareWorker,
  type CloudflareWorkerReleaseTarget,
} from './lib/cloudflare-worker-release-readiness';

const target = process.argv[2] as CloudflareWorkerReleaseTarget | undefined;

if (!target || !(target in CLOUDFLARE_WORKER_RELEASE_CONFIGS)) {
  process.stderr.write(
    'Usage: bun scripts/deploy-cloudflare-worker.ts <workspace-edge|os-device-authority>\n',
  );
  process.exitCode = 2;
} else {
  try {
    await deployCloudflareWorker({ target });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
