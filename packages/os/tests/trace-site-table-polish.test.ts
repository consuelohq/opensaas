import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  createDefaultNodeYamlConfig,
  writeYamlConfig,
} from '../scripts/lib/consuelo-home';
import { logToolExecution } from '../scripts/lib/facade/logger';
import { withTraceRoutingContext } from '../scripts/lib/trace-routing-context';
import { createLocalTraceSitesReadBackend } from '../scripts/lib/trace-sites-local-read-backend';
import { traceTokenUsage } from '../scripts/lib/trace-site-inspector/model';
import { formatTraceTableRow } from '../scripts/lib/trace-site-inspector/table-formatters';

it('persists the executing local node without overriding trusted routing or inventing a default', async () => {
  const home = mkdtempSync(join(tmpdir(), 'trace-node-owner-'));
  const dbPath = join(home, 'traces.db');
  try {
    writeYamlConfig(
      join(home, 'node', 'node.yaml'),
      createDefaultNodeYamlConfig({
        nodeId: 'node_test',
        nodeName: 'Test Mac',
        workspaceId: 'wrk_test',
      }),
    );
    const record = (
      traceId: string,
      env = { CONSUELO_HOME: home, CONSUELO_TRACE_DB: dbPath },
    ) =>
      logToolExecution({
        tool: 'fs.read',
        traceId,
        command: 'read fixture',
        durationMs: 10,
        exitCode: 0,
        ok: true,
        code: 'OK',
        capabilities: { readOnly: true, mutating: false },
        input: { path: 'fixture.ts' },
        result: {
          ok: true,
          code: 'OK',
          data: { content: 'A captured fixture' },
        },
        emit: false,
        env,
      });
    record('local-call');
    withTraceRoutingContext(
      {
        requestedNodeId: 'node_remote',
        resolvedNodeId: 'node_remote',
        resolvedNodeName: 'Remote Mac',
        defaultNodeId: 'node_default',
        routeSource: 'explicit',
      },
      () => record('remote-call'),
    );
    withTraceRoutingContext(
      {
        resolvedNodeId: 'node_test',
        resolvedNodeName: 'Test Mac',
        defaultNodeId: 'node_test',
        routeSource: 'default',
      },
      () => record('default-call'),
    );
    record('unknown-call', {
      CONSUELO_HOME: join(home, 'unprovisioned'),
      CONSUELO_TRACE_DB: dbPath,
    });
    const page = await createLocalTraceSitesReadBackend({ dbPath })
      .readHistoryPage!({
      workspaceId: 'wrk_test',
      workspaceHost: 'test.example',
      site: 'trace-burn-intelligence',
      sourceMode: 'local-networked',
      cursor: 'latest',
      limit: 10,
    });
    const local = page.rows.find((row) => row.traceId === 'local-call')!;
    expect(local.resolvedNodeId).toBe('node_test');
    expect(local.resolvedNodeName).toBe('Test Mac');
    expect(local.routeSource).toBe('local');
    expect(local.defaultNodeId).toBeUndefined();
    expect(formatTraceTableRow(local).nodeLabel).toBe('Test Mac');
    expect(
      page.rows.find((row) => row.traceId === 'remote-call'),
    ).toMatchObject({
      resolvedNodeId: 'node_remote',
      resolvedNodeName: 'Remote Mac',
      defaultNodeId: 'node_default',
      routeSource: 'explicit',
    });
    expect(
      page.rows.find((row) => row.traceId === 'default-call'),
    ).toMatchObject({
      resolvedNodeId: 'node_test',
      defaultNodeId: 'node_test',
      routeSource: 'default',
    });
    expect(
      page.rows.find((row) => row.traceId === 'unknown-call')?.resolvedNodeId,
    ).toBeUndefined();
    for (const row of page.rows)
      expect(traceTokenUsage(row).total.value).toBeGreaterThan(0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
