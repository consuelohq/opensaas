#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Row = Record<string, unknown>;
const defaultTraceDb = join(homedir(), "Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db");
const traceDb = process.env.TRACE_DB || Bun.argv.find((arg) => arg.startsWith("--db="))?.slice(5) || defaultTraceDb;
const windowArg = Bun.argv.find((arg) => arg.startsWith("--window="))?.slice(9) || "past_day";
const limit = Number(Bun.argv.find((arg) => arg.startsWith("--limit="))?.slice(8) || 25);
const asJson = Bun.argv.includes("--json");
const windows: Record<string, string> = { past_hour: "-1 hour", past_day: "-1 day", past_week: "-7 days", past_month: "-30 days" };
const since = windows[windowArg] || windows.past_day;
if (!existsSync(traceDb)) { console.error(`trace db not found: ${traceDb}`); process.exit(1); }
function sqlJson(sql: string): Row[] { const result = spawnSync("sqlite3", ["-json", traceDb, sql], { encoding: "utf8" }); if (result.status !== 0) { console.error(result.stderr || result.stdout); process.exit(result.status || 1); } const text = result.stdout.trim(); return text ? JSON.parse(text) as Row[] : []; }
const estimatedInput = `CAST(round((length(coalesce(input_json, '')) + length(coalesce(resolved_input_json, ''))) / 4.0) AS INTEGER)`;
const estimatedOutput = `CAST(round((length(coalesce(result_json, '')) + length(coalesce(stderr, ''))) / 4.0) AS INTEGER)`;
const inputMixed = `coalesce(input_tokens, ${estimatedInput})`;
const outputMixed = `coalesce(output_tokens, ${estimatedOutput})`;
const totalMixed = `coalesce(total_tokens, ${inputMixed} + ${outputMixed})`;
const topTools = sqlJson(`SELECT tool, count(*) AS calls, count(total_tokens) AS tracked_rows, count(*) - count(total_tokens) AS estimated_rows, coalesce(sum(${inputMixed}),0) AS input_tokens, coalesce(sum(${outputMixed}),0) AS output_tokens, coalesce(sum(${totalMixed}),0) AS total_tokens, printf('%.2fs', coalesce(sum(duration_ms),0)/1000.0) AS total_duration, sum(CASE WHEN status != 'ok' OR code != 'OK' THEN 1 ELSE 0 END) AS errors, max(ts) AS last_seen FROM tool_traces WHERE ts >= datetime('now', '${since}') GROUP BY tool ORDER BY total_tokens DESC, calls DESC LIMIT ${Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 25};`);
const errorCodes = sqlJson(`SELECT tool, code, count(*) AS errors, printf('%.2fs', coalesce(avg(duration_ms),0)/1000.0) AS avg_duration, max(ts) AS last_seen FROM tool_traces WHERE ts >= datetime('now', '${since}') AND (status != 'ok' OR code != 'OK') GROUP BY tool, code ORDER BY errors DESC, tool ASC LIMIT 50;`);
const branchesByTool = sqlJson(`SELECT tool, coalesce(nullif(branch,''), '(no branch)') AS branch, count(*) AS calls, coalesce(sum(${totalMixed}),0) AS total_tokens, sum(CASE WHEN status != 'ok' OR code != 'OK' THEN 1 ELSE 0 END) AS errors FROM tool_traces WHERE ts >= datetime('now', '${since}') GROUP BY tool, branch ORDER BY total_tokens DESC LIMIT 75;`);
const payload = { trace_db: traceDb, window: windowArg, top_tools: topTools, error_codes: errorCodes, branches_by_tool: branchesByTool };
if (asJson) { console.log(JSON.stringify(payload, null, 2)); process.exit(0); }
const nf = new Intl.NumberFormat('en-US');
function fmt(v: unknown) { const n = Number(v); return Number.isFinite(n) ? nf.format(Math.round(n)) : String(v ?? ''); }
console.log(`Top tools — ${windowArg}`);
console.log('====================');
console.log(`trace_db: ${traceDb}`);
console.log('tool                         calls      tokens       output       errors');
for (const row of topTools) { const tool = String(row.tool ?? '').padEnd(28).slice(0,28); console.log(`${tool} ${String(fmt(row.calls)).padStart(7)} ${String(fmt(row.total_tokens)).padStart(11)} ${String(fmt(row.output_tokens)).padStart(11)} ${String(fmt(row.errors)).padStart(7)}`); }
console.log('\nUse --json for the cockpit data contract.');
