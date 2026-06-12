import {
  createWorkspaceEdgeRouteSeedSql,
  type WorkspaceEdgeRouteSeedInput,
} from './lib/workspace-edge-route-seed';

const readArg = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
};

const readInput = (): WorkspaceEdgeRouteSeedInput => ({
  workspaceId:
    readArg('--workspace-id') ??
    process.env.CONSUELO_WORKSPACE_EDGE_SEED_WORKSPACE_ID,
  workspaceSlug:
    readArg('--workspace-slug') ??
    process.env.CONSUELO_WORKSPACE_EDGE_SEED_WORKSPACE_SLUG,
  hostname:
    readArg('--workspace-host') ??
    process.env.CONSUELO_WORKSPACE_EDGE_SEED_WORKSPACE_HOST,
  baseDomain:
    readArg('--base-domain') ??
    process.env.CONSUELO_WORKSPACE_EDGE_SEED_BASE_DOMAIN,
  appUpstreamUrl:
    readArg('--app-upstream-url') ??
    process.env.CONSUELO_WORKSPACE_EDGE_SEED_APP_UPSTREAM_URL,
  connectorId:
    readArg('--connector-id') ??
    process.env.CONSUELO_WORKSPACE_EDGE_SEED_CONNECTOR_ID,
  tunnelOriginUrl:
    readArg('--tunnel-origin-url') ??
    process.env.CONSUELO_WORKSPACE_EDGE_SEED_TUNNEL_ORIGIN_URL,
  localServiceUrl:
    readArg('--local-service-url') ??
    process.env.CONSUELO_WORKSPACE_EDGE_SEED_LOCAL_SERVICE_URL,
});

const executeSql = async (sql: string): Promise<void> => {
  try {
    const child = Bun.spawn(
      [
        'wrangler',
        'd1',
        'execute',
        'consuelo-workspace-route-registry',
        '--remote',
        '--config',
        'cloudflare/workspace-edge/wrangler.toml',
        '--command',
        sql,
      ],
      {
        stdout: 'inherit',
        stderr: 'inherit',
      },
    );
    const exitCode = await child.exited;

    if (exitCode !== 0) {
      throw new Error(`wrangler exited with code ${exitCode}`);
    }
  } catch (error: unknown) {
    throw new Error('workspace edge route seed failed', { cause: error });
  }
};

const run = async (): Promise<void> => {
  const sql = createWorkspaceEdgeRouteSeedSql(readInput());

  if (!process.argv.includes('--execute')) {
    process.stdout.write(`${sql}\n`);
    return;
  }

  await executeSql(sql);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
