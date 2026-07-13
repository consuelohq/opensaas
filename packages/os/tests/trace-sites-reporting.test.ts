import { describe, expect, test } from "bun:test";

import {
  createTraceSitesGatewayReportEndpoint,
  createTraceSitesReportLibrary,
} from "../scripts/lib/trace-sites-reporting";

const rows = [
  {
    id: "trace_001",
    cursor: "cur_001",
    idempotencyKey: "idem_001",
    toolName: "workspace.context.search",
    status: "ok",
    durationMs: 20,
    inputTokens: 100,
    outputTokens: 20,
    estimatedCostUsd: 0.001,
  },
  {
    id: "trace_002",
    cursor: "cur_002",
    idempotencyKey: "idem_002",
    toolName: "workspace.context.search",
    status: "failed",
    code: "COMMAND_FAILED",
    errorCause: "Context search failed.",
    durationMs: 50,
    inputTokens: 40,
    outputTokens: 5,
    estimatedCostUsd: 0.0004,
  },
  {
    id: "trace_003",
    cursor: "cur_003",
    idempotencyKey: "idem_003",
    toolName: "workspace.task.start",
    status: "ok",
    durationMs: 80,
    inputTokens: 150,
    outputTokens: 30,
    estimatedCostUsd: 0.002,
  },
];

function assertNoRuntimeLeak(value: unknown) {
  const serialized = JSON.stringify(value);

  expect(serialized).not.toContain("sqlite");
  expect(serialized).not.toContain(".db");
  expect(serialized).not.toContain("/tmp/");
  expect(serialized).not.toContain("localhost:");
  expect(serialized).not.toContain("127.0.0.1");
  expect(serialized).not.toContain("backendServiceName");
  expect(serialized).not.toContain("connectorUrl");
}

describe("Trace Sites reporting contract", () => {
  test("top tools report is produced by shared report logic with window and staleness metadata", async () => {
    const reporting = createTraceSitesReportLibrary({
      readRows: async () => rows,
      now: () => "2026-06-16T00:00:00.000Z",
    });

    const report = await reporting.topTools({
      workspaceId: "wrk_trace_sites_tdd",
      window: "24h",
      cursor: "cur_000",
    });

    expect(report).toMatchObject({
      ok: true,
      publicBoundary: "consuelo-gateway",
      workspaceId: "wrk_trace_sites_tdd",
      view: "top-tools",
      cursor: "cur_003",
      window: "24h",
      generatedAt: "2026-06-16T00:00:00.000Z",
      dataState: "fresh",
    });
    expect(report.report.tools).toEqual([
      expect.objectContaining({ toolName: "workspace.context.search", calls: 2, failures: 1 }),
      expect.objectContaining({ toolName: "workspace.task.start", calls: 1, failures: 0 }),
    ]);
    assertNoRuntimeLeak(report);
  });

  test("errors report returns failure causes and treats empty error set as an empty report", async () => {
    const reporting = createTraceSitesReportLibrary({
      readRows: async () => rows,
      now: () => "2026-06-16T00:00:00.000Z",
    });

    const report = await reporting.errors({
      workspaceId: "wrk_trace_sites_tdd",
      window: "24h",
      cursor: "cur_000",
    });

    expect(report).toMatchObject({
      ok: true,
      publicBoundary: "consuelo-gateway",
      view: "errors",
      dataState: "fresh",
    });
    expect(report.report.errors).toEqual([
      expect.objectContaining({
        code: "COMMAND_FAILED",
        count: 1,
        latestTraceId: "trace_002",
      }),
    ]);
    assertNoRuntimeLeak(report);

    const emptyReporting = createTraceSitesReportLibrary({
      readRows: async () => rows.filter((row) => row.status === "ok"),
      now: () => "2026-06-16T00:00:00.000Z",
    });
    const emptyReport = await emptyReporting.errors({
      workspaceId: "wrk_trace_sites_tdd",
      window: "24h",
      cursor: "cur_000",
    });

    expect(emptyReport).toMatchObject({
      ok: true,
      report: { errors: [] },
    });
  });

  test("costs report handles zero-cost rows explicitly and returns token/cost summary", async () => {
    const reporting = createTraceSitesReportLibrary({
      readRows: async () => [
        ...rows,
        {
          id: "trace_zero_cost",
          cursor: "cur_004",
          idempotencyKey: "idem_zero_cost",
          toolName: "workspace.fs.read",
          status: "ok",
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
        },
      ],
      now: () => "2026-06-16T00:00:00.000Z",
    });

    const report = await reporting.costs({
      workspaceId: "wrk_trace_sites_tdd",
      window: "24h",
      cursor: "cur_000",
    });

    expect(report).toMatchObject({
      ok: true,
      publicBoundary: "consuelo-gateway",
      view: "costs",
      report: {
        inputTokens: 290,
        outputTokens: 55,
        totalTokens: 345,
        totalCostUsd: 0.0034,
        zeroCostRows: 1,
      },
    });
    assertNoRuntimeLeak(report);
  });

  test("gateway report endpoint dispatches explicit report routes and returns unavailable as structured degraded state", async () => {
    const endpoint = createTraceSitesGatewayReportEndpoint({
      reporting: createTraceSitesReportLibrary({
        readRows: async () => rows,
        now: () => "2026-06-16T00:00:00.000Z",
      }),
    });

    const response = await endpoint.handle({
      method: "GET",
      path: "/gateway/traces/reports/top-tools",
      workspaceId: "wrk_trace_sites_tdd",
      window: "24h",
      cursor: "cur_000",
      session: {
        workspaceId: "wrk_trace_sites_tdd",
        allowedSites: ["trace"],
        capabilities: ["trace-read", "trace-report"],
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      publicBoundary: "consuelo-gateway",
      view: "top-tools",
    });
    assertNoRuntimeLeak(body);

    const unavailableEndpoint = createTraceSitesGatewayReportEndpoint({
      reporting: createTraceSitesReportLibrary({
        readRows: async () => {
          throw Object.assign(new Error("local store unavailable at /tmp/private/traces.db"), {
            code: "TRACE_STORE_UNAVAILABLE",
          });
        },
      }),
    });
    const unavailable = await unavailableEndpoint.handle({
      method: "GET",
      path: "/gateway/traces/reports/costs",
      workspaceId: "wrk_trace_sites_tdd",
      session: {
        workspaceId: "wrk_trace_sites_tdd",
        allowedSites: ["trace"],
        capabilities: ["trace-read", "trace-report"],
      },
    });

    expect(unavailable.status).toBe(503);
    const unavailableBody = await unavailable.json();
    expect(unavailableBody).toMatchObject({
      ok: false,
      publicBoundary: "consuelo-gateway",
      code: "TRACE_STORE_UNAVAILABLE",
      dataState: "degraded",
    });
    assertNoRuntimeLeak(unavailableBody);
  });
});
