import { describe, expect, test } from "bun:test";

import {
  createTraceSitesBrowserClient,
  type TraceSitesBrowserTransport,
} from "../scripts/lib/trace-sites-browser-client";

const workspaceId = "wrk_trace_sites_tdd";

function assertNoBackendLeak(value: unknown) {
  const serialized = JSON.stringify(value);

  expect(serialized).not.toContain("sqlite");
  expect(serialized).not.toContain(".db");
  expect(serialized).not.toContain("127.0.0.1");
  expect(serialized).not.toContain("localhost:");
  expect(serialized).not.toContain("connectorUrl");
  expect(serialized).not.toContain("cloud-runner");
  expect(serialized).not.toContain("backendServiceName");
}

function createTransport(overrides: Partial<TraceSitesBrowserTransport> = {}): TraceSitesBrowserTransport {
  return {
    async fetchJson(path) {
      if (path === "/gateway/traces/recent") {
        return {
          ok: true,
          publicBoundary: "consuelo-gateway",
          workspaceId,
          cursor: "cur_001",
          events: [
            {
              id: "trace_001",
              cursor: "cur_001",
              idempotencyKey: "idem_001",
              toolName: "workspace.context.search",
              status: "ok",
            },
          ],
        };
      }
      if (path === "/gateway/traces/summary") {
        return {
          ok: true,
          publicBoundary: "consuelo-gateway",
          workspaceId,
          cursor: "cur_001",
          summary: {
            total: 1,
            succeeded: 1,
            failed: 0,
            totalCostUsd: 0,
          },
        };
      }
      throw new Error(`unexpected fetch path ${path}`);
    },
    createEventSource(path, handlers) {
      expect(path).toBe("/gateway/traces/events?cursor=cur_001");
      queueMicrotask(() => {
        handlers.onMessage({
          type: "trace",
          cursor: "cur_002",
          trace: {
            id: "trace_002",
            cursor: "cur_002",
            idempotencyKey: "idem_002",
            toolName: "workspace.task.start",
            status: "ok",
          },
        });
        handlers.onMessage({ type: "state", state: "live", cursor: "cur_002" });
      });

      return { close() {} };
    },
    async wait() {},
    ...overrides,
  };
}

describe("Trace Sites browser client contract", () => {
  test("loads recent and summary, connects to live events, dedupes deltas, and exposes live state", async () => {
    const client = createTraceSitesBrowserClient({
      workspaceId,
      transport: createTransport(),
    });

    const state = await client.start();

    expect(state).toMatchObject({
      status: "live",
      workspaceId,
      cursor: "cur_002",
      summary: {
        total: 1,
        succeeded: 1,
      },
    });
    expect(state.events.map((event) => event.id)).toEqual([
      "trace_001",
      "trace_002",
    ]);
    assertNoBackendLeak(state);
  });

  test("falls back to cursor polling when EventSource cannot be established", async () => {
    const paths: string[] = [];
    const client = createTraceSitesBrowserClient({
      workspaceId,
      transport: createTransport({
        createEventSource() {
          throw new Error("eventsource unavailable");
        },
        async fetchJson(path) {
          paths.push(path);
          if (path === "/gateway/traces/recent") {
            return {
              ok: true,
              publicBoundary: "consuelo-gateway",
              workspaceId,
              cursor: "cur_001",
              events: [],
            };
          }
          if (path === "/gateway/traces/summary") {
            return {
              ok: true,
              publicBoundary: "consuelo-gateway",
              workspaceId,
              cursor: "cur_001",
              summary: { total: 0, succeeded: 0, failed: 0 },
            };
          }
          if (path === "/gateway/traces/recent?cursor=cur_001") {
            return {
              ok: true,
              publicBoundary: "consuelo-gateway",
              workspaceId,
              cursor: "cur_002",
              events: [
                {
                  id: "trace_polled",
                  cursor: "cur_002",
                  idempotencyKey: "idem_polled",
                  toolName: "workspace.fs.read",
                  status: "ok",
                },
              ],
            };
          }
          throw new Error(`unexpected fetch path ${path}`);
        },
      }),
      polling: {
        maxPollsForTest: 1,
      },
    });

    const state = await client.start();

    expect(paths).toContain("/gateway/traces/recent?cursor=cur_001");
    expect(state).toMatchObject({
      status: "stale",
      cursor: "cur_002",
    });
    expect(state.events).toContainEqual(
      expect.objectContaining({ id: "trace_polled" }),
    );
    assertNoBackendLeak(state);
  });

  test("keeps browser responses on hosted gateway routes and rejects direct local runtime paths", async () => {
    const attemptedPaths: string[] = [];
    const client = createTraceSitesBrowserClient({
      workspaceId,
      transport: createTransport({
        async fetchJson(path) {
          attemptedPaths.push(path);
          if (path.includes("127.0.0.1") || path.includes("localhost")) {
            throw new Error("browser attempted direct local runtime access");
          }
          if (path === "/gateway/traces/recent") {
            return {
              ok: true,
              publicBoundary: "consuelo-gateway",
              workspaceId,
              cursor: "cur_001",
              events: [],
            };
          }
          if (path === "/gateway/traces/summary") {
            return {
              ok: true,
              publicBoundary: "consuelo-gateway",
              workspaceId,
              cursor: "cur_001",
              summary: { total: 0, succeeded: 0, failed: 0 },
            };
          }
          throw new Error(`unexpected fetch path ${path}`);
        },
      }),
      polling: {
        maxPollsForTest: 0,
      },
    });

    await client.start();

    expect(attemptedPaths.every((path) => path.startsWith("/gateway/traces"))).toBe(true);
    expect(attemptedPaths.some((path) => path.includes("127.0.0.1"))).toBe(false);
    expect(attemptedPaths.some((path) => path.includes("localhost"))).toBe(false);
  });

  test("surfaces bridge-required as product state instead of treating it as generic failure", async () => {
    const client = createTraceSitesBrowserClient({
      workspaceId,
      transport: createTransport({
        async fetchJson(path) {
          if (path === "/gateway/traces/recent") {
            return {
              ok: false,
              publicBoundary: "consuelo-gateway",
              code: "BRIDGE_REQUIRED",
              sourceMode: "local-networked",
            };
          }
          if (path === "/gateway/traces/summary") {
            return {
              ok: false,
              publicBoundary: "consuelo-gateway",
              code: "BRIDGE_REQUIRED",
              sourceMode: "local-networked",
            };
          }
          throw new Error(`unexpected fetch path ${path}`);
        },
      }),
    });

    const state = await client.start();

    expect(state).toMatchObject({
      status: "bridge-required",
      publicBoundary: "consuelo-gateway",
      sourceMode: "local-networked",
    });
    assertNoBackendLeak(state);
  });
});
