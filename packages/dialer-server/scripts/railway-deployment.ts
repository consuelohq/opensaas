import {
  parseRailwayDeploymentList,
  selectNewRailwayDeployment,
} from '../src/release/production-release.js';

const terminalSuccess = new Set(['SUCCESS']);
const terminalFailure = new Set(['FAILED', 'CRASHED', 'REMOVED', 'REMOVING']);
const pending = new Set([
  'BUILDING',
  'DEPLOYING',
  'INITIALIZING',
  'WAITING',
  'QUEUED',
]);

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const list = (): ReturnType<typeof parseRailwayDeploymentList> => {
  const result = Bun.spawnSync({
    cmd: [
      'bunx',
      '@railway/cli@5.27.2',
      'deployment',
      'list',
      '--service',
      required('RAILWAY_DIALER_SERVICE_ID'),
      '--environment',
      required('RAILWAY_DIALER_ENVIRONMENT_ID'),
      '--limit',
      '20',
      '--json',
    ],
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Railway deployment list failed: ${new TextDecoder().decode(result.stderr).trim()}`,
    );
  }
  return parseRailwayDeploymentList(new TextDecoder().decode(result.stdout));
};

const action = process.argv[2]?.trim();
if (action === 'latest') {
  const latest = list()[0] ?? null;
  process.stdout.write(`${JSON.stringify(latest)}\n`);
} else if (action === 'wait') {
  const previousId = process.argv[3]?.trim() ?? '';
  if (!previousId)
    throw new Error('Previous Railway deployment ID is required');
  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    const deployment = selectNewRailwayDeployment(list(), previousId);
    if (!deployment) {
      await Bun.sleep(5_000);
      continue;
    }
    if (terminalSuccess.has(deployment.status)) {
      process.stdout.write(
        `${JSON.stringify({ deploymentId: deployment.id, status: deployment.status })}\n`,
      );
      process.exit(0);
    }
    if (terminalFailure.has(deployment.status)) {
      process.stderr.write(
        `${JSON.stringify({ deploymentId: deployment.id, status: deployment.status })}\n`,
      );
      process.exit(1);
    }
    if (!pending.has(deployment.status)) {
      throw new Error(
        `Unexpected Railway deployment status: ${deployment.status}`,
      );
    }
    await Bun.sleep(5_000);
  }
  throw new Error('Timed out waiting for the new Railway deployment');
} else if (action === 'wait-id') {
  const deploymentId = process.argv[3]?.trim() ?? '';
  if (!deploymentId) throw new Error('Railway deployment ID is required');
  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    const deployment = list().find(({ id }) => id === deploymentId) ?? null;
    if (!deployment) {
      await Bun.sleep(5_000);
      continue;
    }
    if (terminalSuccess.has(deployment.status)) {
      process.stdout.write(
        `${JSON.stringify({ deploymentId: deployment.id, status: deployment.status })}\n`,
      );
      process.exit(0);
    }
    if (terminalFailure.has(deployment.status)) {
      process.stderr.write(
        `${JSON.stringify({ deploymentId: deployment.id, status: deployment.status })}\n`,
      );
      process.exit(1);
    }
    if (!pending.has(deployment.status)) {
      throw new Error(
        `Unexpected Railway deployment status: ${deployment.status}`,
      );
    }
    await Bun.sleep(5_000);
  }
  throw new Error('Timed out waiting for the Railway deployment ID');
} else {
  throw new Error(
    'Expected railway-deployment action: latest, wait, or wait-id',
  );
}
