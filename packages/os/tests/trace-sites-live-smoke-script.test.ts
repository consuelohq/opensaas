import { describe, expect, test } from "bun:test";

import {
  createTraceSitesLiveSmokePlan,
  runTraceSitesLiveSmokeForTest,
} from "../scripts/lib/trace-sites-live-smoke";

function assertNoLocalLeak(value: unknown) {
  const serialized = JSON.stringify(value);

  expect(serialized).not.toContain("/tmp/");
  expect(serialized).not.toContain("/Users/");
  expect(serialized).not.toContain(".db");
  expect(serialized).not.toContain("127.0.0.1");
  expect(serialized).not.toContain("localhost:");
  expect(serialized).not.toContain("connectorUrl");
  expect(serialized).not.toContain("tunnelOriginUrl");
}

describe("Trace Sites live smoke script contract", () => {
  test("builds a dogfood plan that proves product-path trace visibility without direct browser-local calls", () => {
    const plan = createTraceSitesLiveSmokePlan({
      workspaceHost: "trace-sites-test.consuelohq.com",
      workspaceId: "wrk_trace_sites_tdd",
      requireSse: false,
    });

    expect(plan.steps.map((step) => step.name)).toEqual([
      "discover-trace-store",
      "verify-local-bun-gateway",
      "read-starting-cursor",
      "generate-harmless-trace",
      "poll-gateway-recent-until-visible",
      "check-sse-optional",
      "print-json-result",
    ]);
    expect(plan.productRoutes).toEqual([
      "https://trace-sites-test.consuelohq.com/gateway/traces/recent",
      "https://trace-sites-test.consuelohq.com/gateway/traces/events",
    ]);
    expect(plan.forbiddenRoutes).toEqual([
      "http://127.0.0.1:8960/gateway/traces/recent",
      "http://localhost:8960/gateway/traces/recent",
    ]);
    assertNoLocalLeak(plan.browserVisibleOutputShape);
  });

  test("runs the smoke flow, observes generated trace through gateway recent, and prints compact JSON", async () => {
    let printed: unknown = null;
    const result = await runTraceSitesLiveSmokeForTest({
      workspaceId: "wrk_trace_sites_tdd",
      discoverTraceStore: async () => ({
        ok: true,
        storeId: "trace_store_test",
      }),
      verifyLocalGateway: async () => ({
        ok: true,
        publicBoundary: "consuelo-gateway",
      }),
      readStartingCursor: async () => ({
        ok: true,
        cursor: "cur_001",
      }),
      generateHarmlessTrace: async () => ({
        ok: true,
        trace: {
          id: "trace_smoke_001",
          idempotencyKey: "smoke_idem_001",
        },
      }),
      pollGatewayRecentUntilVisible: async () => ({
        ok: true,
        cursor: "cur_002",
        trace: {
          id: "trace_smoke_001",
          idempotencyKey: "smoke_idem_001",
        },
      }),
      checkSse: async () => ({
        ok: false,
        skipped: true,
        reason: "network-prerequisite-missing",
      }),
      printResult: async (value) => {
        printed = value;
      },
    });

    expect(result).toMatchObject({
      ok: true,
      publicBoundary: "consuelo-gateway",
      workspaceId: "wrk_trace_sites_tdd",
      cursor: "cur_002",
      traceVisible: true,
      sse: {
        checked: false,
        skipped: true,
      },
    });

    expect(printed).toEqual(result);
    assertNoLocalLeak(result);
    assertNoLocalLeak(printed);
  });

  test("fails closed with a structured product-path error when the local Bun gateway is unavailable", async () => {
    const result = await runTraceSitesLiveSmokeForTest({
      workspaceId: "wrk_trace_sites_tdd",
      discoverTraceStore: async () => ({
        ok: true,
        storeId: "trace_store_test",
      }),
      verifyLocalGateway: async () => ({
        ok: false,
        error: {
          code: "LOCAL_GATEWAY_UNAVAILABLE",
          message: "Local gateway unavailable.",
        },
      }),
      readStartingCursor: async () => {
        throw new Error("should not read cursor");
      },
      generateHarmlessTrace: async () => {
        throw new Error("should not generate trace");
      },
      pollGatewayRecentUntilVisible: async () => {
        throw new Error("should not poll");
      },
      checkSse: async () => {
        throw new Error("should not check sse");
      },
      printResult: async () => {},
    });

    expect(result).toMatchObject({
      ok: false,
      publicBoundary: "consuelo-gateway",
      error: {
        code: "LOCAL_GATEWAY_UNAVAILABLE",
      },
    });

    assertNoLocalLeak(result);
  });
});
