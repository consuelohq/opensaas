import { describe, expect, test } from "vitest";

import {
  applyTraceFeed,
  createTraceExplorerState,
  filterTraceRows,
  normalizeTraceRow,
  normalizeTraceRows,
  selectTraceByKey,
  stableTraceKey,
  traceFeedSignature,
} from "../src/scripts/traceStore";

type TestTraceRow = ReturnType<typeof row>;

const feed = (rows: TestTraceRow[], generatedAt = "2026-06-23T06:00:00.000Z") => ({
  meta: {
    generatedAt,
    rowCount: rows.length,
    failureCount: rows.filter((row) => row.status === "error").length,
    maxRowid: Math.max(...rows.map((row) => row.metadata?.rowid ?? 0), 0),
  },
  rows,
  failures: rows.filter((row) => row.status === "error"),
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: overrides.id ?? 0,
  recordId: overrides.recordId ?? "trace-record-1",
  startTime: overrides.startTime ?? "2026-06-23 06:05:21",
  time: overrides.time,
  type: overrides.type ?? "mcp",
  name: overrides.name ?? "code.call",
  branch: overrides.branch ?? "task/design/rewrite-trace-burn-intelligence-in-astro-with-tdd",
  status: overrides.status ?? "success",
  code: overrides.code ?? "OK",
  input: overrides.input ?? "input payload",
  output: overrides.output ?? "output payload",
  summary: overrides.summary ?? "summary",
  metadata: overrides.metadata ?? { trace_id: "trace-id-1", rowid: 101 },
  latency: overrides.latency ?? "120ms",
  durationMs: overrides.durationMs ?? 120,
  cost: overrides.cost ?? 0.001,
  costLabel: overrides.costLabel ?? "$0.0010",
  tokens: overrides.tokens ?? 100,
  inputTokens: overrides.inputTokens ?? 40,
  outputTokens: overrides.outputTokens ?? 60,
  rawInputJson: overrides.rawInputJson ?? '{"content":"input payload"}',
  rawResolvedInputJson: overrides.rawResolvedInputJson ?? '{"content":"input payload"}',
  rawResultJson: overrides.rawResultJson ?? '{"ok":true}',
  rawStderr: overrides.rawStderr ?? "",
});

describe("Trace Burn Intelligence trace store", () => {
  test("normalizes rows with stable keys and time-only display labels", () => {
    const normalized = normalizeTraceRow(row({ id: 42, recordId: "stable-record", startTime: "2026-06-23 05:48:10" }));

    expect(stableTraceKey(normalized)).toBe("stable-record");
    expect(normalized.displayTime).toBe("05:48:10");
    expect(normalized.displayTime).not.toContain("2026");
    expect(normalized.rawInputJson).toContain("input payload");
    expect(normalized.rawResultJson).toContain("true");
  });

  test("stable keys do not depend on feed-local numeric ids", () => {
    const first = normalizeTraceRow(row({ id: 0, recordId: "same-record", metadata: { trace_id: "same-trace", rowid: 9 } }));
    const second = normalizeTraceRow(row({ id: 249, recordId: "same-record", metadata: { trace_id: "same-trace", rowid: 9 } }));

    expect(stableTraceKey(first)).toBe(stableTraceKey(second));
  });

  test("feed signature ignores generatedAt so polling does not rerender unchanged rows", () => {
    const rows = normalizeTraceRows([row({ metadata: { trace_id: "trace-id-1", rowid: 100 } })]);

    expect(traceFeedSignature(feed(rows, "2026-06-23T06:00:00.000Z"))).toBe(
      traceFeedSignature(feed(rows, "2026-06-23T06:00:15.000Z")),
    );
  });

  test("applyTraceFeed preserves selected detail row across feed refreshes with reset ids", () => {
    const initialRows = normalizeTraceRows([
      row({ id: 0, recordId: "selected", name: "github", metadata: { trace_id: "selected-trace", rowid: 10 } }),
      row({ id: 1, recordId: "other", name: "code.call", metadata: { trace_id: "other-trace", rowid: 9 } }),
    ]);
    let state = createTraceExplorerState(feed(initialRows));
    state = selectTraceByKey(state, "selected");
    expect(state.mode).toBe("detail");

    const nextRows = normalizeTraceRows([
      row({ id: 249, recordId: "selected", name: "github", metadata: { trace_id: "selected-trace", rowid: 11 }, output: "fresh selected output" }),
      row({ id: 0, recordId: "newest", name: "verify", metadata: { trace_id: "newest-trace", rowid: 12 } }),
    ]);

    state = applyTraceFeed(state, feed(nextRows, "2026-06-23T06:01:00.000Z"));

    expect(state.mode).toBe("detail");
    expect(state.selectedKey).toBe("selected");
    expect(state.selectedTrace?.id).toBe(249);
    expect(state.selectedTrace?.output).toBe("fresh selected output");
  });

  test("filtering is explicit and does not mutate selection", () => {
    const rows = normalizeTraceRows([
      row({ recordId: "a", name: "github", branch: "no-branch" }),
      row({ recordId: "b", name: "code.call", branch: "task/design" }),
    ]);
    let state = createTraceExplorerState(feed(rows));
    state = selectTraceByKey(state, "b");

    const filtered = filterTraceRows(state.rows, { tool: "github", branch: null, status: null, query: "" });

    expect(filtered.map((trace) => trace.recordId)).toEqual(["a"]);
    expect(state.selectedKey).toBe("b");
    expect(state.mode).toBe("detail");
  });
});
