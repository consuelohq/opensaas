import { describe, expect, test } from "bun:test";

import {
  collectTraceSitesSseEventsForTest,
  createTraceSitesGatewayLiveStreamEndpoint,
} from "../scripts/lib/trace-sites-gateway-live-stream";

const workspaceId = "wrk_trace_sites_tdd";
const host = "trace-sites-test.consuelohq.com";

function createGatewayRequest(overrides: Record<string, unknown> = {}) {
  return {
    method: "GET",
    url: `https://${host}/gateway/traces/events?cursor=cur_001`,
    host,
    workspaceId,
    session: {
      workspaceId,
      allowedSites: ["trace"],
      capabilities: ["trace-read", "trace-live"],
      sourceModesAllowed: ["local-networked"],
    },
    sourceMode: "local-networked",
    bridgeConfigured: true,
    now: "2026-06-16T00:00:00.000Z",
    ...overrides,
  };
}

function assertNoRuntimeTargetLeak(value: unknown) {
  const serialized = JSON.stringify(value);

  expect(serialized).not.toContain("sqlite");
  expect(serialized).not.toContain(".db");
  expect(serialized).not.toContain("/tmp/");
  expect(serialized).not.toContain("/var/");
  expect(serialized).not.toContain("localhost:");
  expect(serialized).not.toContain("127.0.0.1");
  expect(serialized).not.toContain("local-agent");
  expect(serialized).not.toContain("cloud-runner");
  expect(serialized).not.toContain("trace-file");
  expect(serialized).not.toContain("implementationPath");
  expect(serialized).not.toContain("backendServiceName");
  expect(serialized).not.toContain("connectorUrl");
}

describe("Trace Sites gateway live stream contract", () => {
  test("serves SSE from the Consuelo Gateway route and emits snapshot, delta, keepalive, and state events", async () => {
    const endpoint = createTraceSitesGatewayLiveStreamEndpoint({
      stream: {
        keepAliveMs: 1,
        maxEventsForTest: 4,
        maxDurationMs: 50,
      },
      backend: {
        async readInitialSnapshot() {
          return {
            cursor: "cur_002",
            rows: [
              {
                id: "trace_001",
                cursor: "cur_002",
                idempotencyKey: "idem_001",
                toolName: "workspace.context.search",
                status: "ok",
                startedAt: "2026-06-16T00:00:00.000Z",
              },
            ],
          };
        },
        async readAfterCursor(cursor: string) {
          expect(cursor).toBe("cur_002");

          return {
            cursor: "cur_003",
            rows: [
              {
                id: "trace_002",
                cursor: "cur_003",
                idempotencyKey: "idem_002",
                toolName: "workspace.task.start",
                status: "ok",
                startedAt: "2026-06-16T00:00:01.000Z",
              },
            ],
          };
        },
      },
    });

    const response = await endpoint.handle(createGatewayRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toContain("no-cache");

    const events = await collectTraceSitesSseEventsForTest(response.body, {
      maxEvents: 4,
    });

    expect(events.map((event) => event.type)).toEqual([
      "snapshot",
      "trace",
      "keepalive",
      "state",
    ]);

    expect(events[0]).toMatchObject({
      type: "snapshot",
      cursor: "cur_002",
      publicBoundary: "consuelo-gateway",
      routeFamily: "/gateway/traces/*",
    });

    expect(events[1]).toMatchObject({
      type: "trace",
      cursor: "cur_003",
      trace: {
        id: "trace_002",
        idempotencyKey: "idem_002",
        toolName: "workspace.task.start",
      },
    });

    expect(events[2]).toMatchObject({ type: "keepalive" });
    expect(events[3]).toMatchObject({ type: "state", state: "closing" });

    for (const event of events) assertNoRuntimeTargetLeak(event);
  });

  test("supports cursor resume and does not replay deduped events across reconnects", async () => {
    const seenCursors: string[] = [];
    const endpoint = createTraceSitesGatewayLiveStreamEndpoint({
      stream: {
        keepAliveMs: 1,
        maxEventsForTest: 3,
        maxDurationMs: 50,
      },
      backend: {
        async readInitialSnapshot({ cursor }: { cursor: string }) {
          seenCursors.push(cursor);
          return {
            cursor,
            rows: [
              {
                id: "trace_duplicate",
                cursor,
                idempotencyKey: "idem_duplicate",
                toolName: "workspace.fs.read",
                status: "ok",
              },
            ],
          };
        },
        async readAfterCursor(cursor: string) {
          seenCursors.push(cursor);
          return {
            cursor: "cur_004",
            rows: [
              {
                id: "trace_duplicate",
                cursor: "cur_004",
                idempotencyKey: "idem_duplicate",
                toolName: "workspace.fs.read",
                status: "ok",
              },
              {
                id: "trace_new",
                cursor: "cur_004",
                idempotencyKey: "idem_new",
                toolName: "workspace.fs.search",
                status: "ok",
              },
            ],
          };
        },
      },
    });

    const response = await endpoint.handle(
      createGatewayRequest({
        url: `https://${host}/gateway/traces/events?cursor=cur_003`,
      }),
    );
    const events = await collectTraceSitesSseEventsForTest(response.body, {
      maxEvents: 3,
    });

    const traceEvents = events.filter((event) => event.type === "trace");
    expect(traceEvents).toHaveLength(1);
    expect(traceEvents[0]).toMatchObject({
      type: "trace",
      trace: {
        id: "trace_new",
        idempotencyKey: "idem_new",
      },
    });
    expect(seenCursors).toContain("cur_003");

    for (const event of events) assertNoRuntimeTargetLeak(event);
  });

  test("fails closed with bridge-required when local-networked source mode has no bridge", async () => {
    const endpoint = createTraceSitesGatewayLiveStreamEndpoint({
      backend: {
        async readInitialSnapshot() {
          throw new Error("should not read backend without bridge");
        },
        async readAfterCursor() {
          throw new Error("should not poll backend without bridge");
        },
      },
    });

    const response = await endpoint.handle(
      createGatewayRequest({ bridgeConfigured: false }),
    );
    const body = await response.json();

    expect(response.status).toBe(424);
    expect(body).toMatchObject({
      ok: false,
      publicBoundary: "consuelo-gateway",
      code: "BRIDGE_REQUIRED",
      sourceMode: "local-networked",
    });
    assertNoRuntimeTargetLeak(body);
  });

  test("rejects browser-style custom-header auth for native EventSource and requires an explicit stream auth strategy", async () => {
    const endpoint = createTraceSitesGatewayLiveStreamEndpoint({
      auth: {
        browserStreamAuth: "custom-headers",
      },
      backend: {
        async readInitialSnapshot() {
          return { cursor: "cur_001", rows: [] };
        },
        async readAfterCursor() {
          return { cursor: "cur_001", rows: [] };
        },
      },
    });

    const response = await endpoint.handle(
      createGatewayRequest({
        headers: {
          "x-consuelo-token-id": "tok_browser_should_not_need_this",
          "x-consuelo-signature": "sig_browser_should_not_send_this",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      code: "EVENTSOURCE_AUTH_STRATEGY_REQUIRED",
    });
    assertNoRuntimeTargetLeak(body);
  });

  test("applies backpressure limits and surfaces a degraded state instead of retry storms", async () => {
    const endpoint = createTraceSitesGatewayLiveStreamEndpoint({
      stream: {
        keepAliveMs: 1,
        maxEventsForTest: 2,
        maxBufferedEvents: 1,
      },
      backend: {
        async readInitialSnapshot() {
          return { cursor: "cur_001", rows: [] };
        },
        async readAfterCursor() {
          return {
            cursor: "cur_010",
            rows: [
              { id: "trace_001", cursor: "cur_002", idempotencyKey: "idem_001" },
              { id: "trace_002", cursor: "cur_003", idempotencyKey: "idem_002" },
              { id: "trace_003", cursor: "cur_004", idempotencyKey: "idem_003" },
            ],
          };
        },
      },
    });

    const response = await endpoint.handle(createGatewayRequest());
    const events = await collectTraceSitesSseEventsForTest(response.body, {
      maxEvents: 2,
    });

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "state",
        state: "degraded",
        reason: "BACKPRESSURE_LIMIT_REACHED",
      }),
    );
    for (const event of events) assertNoRuntimeTargetLeak(event);
  });
});
