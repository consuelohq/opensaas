import { describe, expect, test } from "bun:test";

import {
  createTraceObservationService,
  createTraceStoreForTest,
} from "../scripts/lib/trace-store";

function assertNoBrowserLeak(value: unknown) {
  const serialized = JSON.stringify(value);

  expect(serialized).not.toContain("/tmp/");
  expect(serialized).not.toContain("/Users/");
  expect(serialized).not.toContain("sqlite");
  expect(serialized).not.toContain(".db");
  expect(serialized).not.toContain("127.0.0.1");
  expect(serialized).not.toContain("localhost:");
  expect(serialized).not.toContain("local-agent");
  expect(serialized).not.toContain("cloud-runner");
  expect(serialized).not.toContain("connectorUrl");
  expect(serialized).not.toContain("tunnelOriginUrl");
}

describe("OS TraceStore and TraceObservation runtime boundary", () => {
  test("uses one canonical OS trace DB resolver across skill execution, facade observations, worker observations, and Trace Sites reads", async () => {
    const store = createTraceStoreForTest({
      dbPath: "/tmp/private/consuelo-os/traces.db",
      workspaceId: "wrk_trace_sites_tdd",
    });
    const observations = createTraceObservationService({ store });

    await observations.recordSkillExecution({
      traceId: "trc_skill_001",
      workspaceId: "wrk_trace_sites_tdd",
      name: "daily-revenue-brief",
      status: "ok",
      startedAt: "2026-06-16T00:00:00.000Z",
      durationMs: 20,
    });
    await observations.recordFacadeToolExecution({
      traceId: "trc_facade_001",
      workspaceId: "wrk_trace_sites_tdd",
      toolName: "workspace.context.search",
      taskSession: "tsk_001",
      branch: "task/os/trace-sites-tdd",
      status: "ok",
      startedAt: "2026-06-16T00:00:01.000Z",
      durationMs: 30,
    });
    await observations.recordWorkerEvent({
      traceId: "trc_worker_001",
      workspaceId: "wrk_trace_sites_tdd",
      provider: "opc",
      taskSession: "tsk_001",
      eventType: "tool.call",
      toolName: "read",
      status: "ok",
      startedAt: "2026-06-16T00:00:02.000Z",
      durationMs: 40,
    });

    const recent = await store.readRecentForTraceSites({
      workspaceId: "wrk_trace_sites_tdd",
      cursor: "cur_000",
      limit: 10,
    });

    expect(store.describe().canonicalDbPathHash).toMatch(/^sha256:/);
    expect(store.describe().browserSafe).toBe(true);
    expect(recent.events.map((event) => event.traceId)).toEqual([
      "trc_skill_001",
      "trc_facade_001",
      "trc_worker_001",
    ]);
    assertNoBrowserLeak(store.describe());
    assertNoBrowserLeak(recent);
  });

  test("retention pressure never deletes the just-written trace and returns degraded instead of emptying the store", async () => {
    const store = createTraceStoreForTest({
      dbPath: "/tmp/private/consuelo-os/traces.db",
      workspaceId: "wrk_trace_sites_tdd",
      retention: {
        maxBytes: 512,
        minRows: 2,
      },
      simulatedFileSizeBytes: 4096,
    });
    const observations = createTraceObservationService({ store });

    await observations.recordFacadeToolExecution({
      traceId: "trc_old_001",
      workspaceId: "wrk_trace_sites_tdd",
      toolName: "workspace.fs.read",
      status: "ok",
      startedAt: "2026-06-16T00:00:00.000Z",
      durationMs: 10,
    });
    await observations.recordFacadeToolExecution({
      traceId: "trc_old_002",
      workspaceId: "wrk_trace_sites_tdd",
      toolName: "workspace.fs.search",
      status: "ok",
      startedAt: "2026-06-16T00:00:01.000Z",
      durationMs: 10,
    });
    await observations.recordFacadeToolExecution({
      traceId: "trc_new_keep_me",
      workspaceId: "wrk_trace_sites_tdd",
      toolName: "workspace.task.start",
      status: "ok",
      startedAt: "2026-06-16T00:00:02.000Z",
      durationMs: 10,
    });

    const result = await store.enforceRetention({
      reason: "write",
      justWrittenTraceId: "trc_new_keep_me",
    });
    const recent = await store.readRecentForTraceSites({
      workspaceId: "wrk_trace_sites_tdd",
      cursor: "cur_000",
      limit: 10,
    });

    expect(result).toMatchObject({
      ok: true,
      dataState: "degraded",
      reason: "TRACE_STORE_SIZE_LIMIT_REACHED",
    });
    expect(recent.events.map((event) => event.traceId)).toContain("trc_new_keep_me");
    expect(recent.events.length).toBeGreaterThanOrEqual(2);
    assertNoBrowserLeak(result);
    assertNoBrowserLeak(recent);
  });

  test("Trace Sites read model can normalize legacy tool_traces and OS skill_executions without exposing either schema", async () => {
    const store = createTraceStoreForTest({
      dbPath: "/tmp/private/consuelo-os/traces.db",
      workspaceId: "wrk_trace_sites_tdd",
    });

    await store.ingestLegacyToolTrace({
      id: "legacy_tool_row_001",
      trace_id: "trc_legacy_tool",
      tool: "workspace.fs.read",
      status: "ok",
      code: "OK",
      rowid: 1,
    });
    await store.ingestLegacySkillExecution({
      trace_id: "trc_legacy_skill",
      name: "daily-revenue-brief",
      status: "succeeded",
      started_at: "2026-06-16T00:00:00.000Z",
      duration_ms: 10,
    });

    const recent = await store.readRecentForTraceSites({
      workspaceId: "wrk_trace_sites_tdd",
      cursor: "cur_000",
      limit: 10,
    });

    expect(recent).toMatchObject({
      ok: true,
      publicBoundary: "consuelo-gateway",
      cursor: "cur_002",
    });
    expect(recent.events).toEqual([
      expect.objectContaining({ traceId: "trc_legacy_tool", toolName: "workspace.fs.read" }),
      expect.objectContaining({ traceId: "trc_legacy_skill", toolName: "daily-revenue-brief" }),
    ]);
    assertNoBrowserLeak(recent);
  });
});
