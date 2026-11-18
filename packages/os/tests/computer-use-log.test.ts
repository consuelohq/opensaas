import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createCodexLogWriter, redactCodexLog } from '../scripts/lib/subagent/computer-use-log';

const secret = 'synthetic-ui-marker';
function event(type: string, tool: string, input: unknown, result?: unknown) {
  return JSON.stringify({ type, item: { id: 'item-one', type: 'mcp_tool_call', server: 'os', tool: 'call',
    arguments: { tool, input }, result, error: result ? { message: secret } : undefined } });
}

describe('Codex computer-use logs', () => {
  it('removes private tool input and output from buffered and split streaming records', () => {
    const ordinary = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'finished' } });
    const source = [
      event('item.started', 'batch', { steps: [{ tool: 'computer.use', input: { text: secret } }] }),
      event('item.completed', 'batch', { steps: [{ tool: 'computer.use' }] }, { snapshot: secret }),
      ordinary,
    ].join('\n') + '\n';
    let out = '';
    const stream = createCodexLogWriter(part => { out += part; });
    for (let i = 0; i < source.length; i += 7) stream.write(source.slice(i, i + 7));
    stream.end();
    expect(out).toBe(redactCodexLog(source));
    expect(out).not.toContain(secret);
    expect(out).toContain(ordinary);
    expect(JSON.parse(out.split('\n')[1]).item.arguments.tool).toBe('batch');
  });

  it('persists sanitized stdout and stderr from a real durable runner', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cu-provider-log-'));
    try {
      const stdoutLogPath = join(dir, 'stdout.log');
      const stderrLogPath = join(dir, 'stderr.log');
      const stdinPath = join(dir, 'stdin.txt');
      const safe = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'finished' } });
      const privateEvent = event('item.completed', 'computer.use', { text: secret }, { snapshot: secret });
      writeFileSync(stdinPath, '');
      const print = "const line=process.env.CU_FIXTURE_EVENT;process.stdout.write(line.slice(0,40));"
        + "setTimeout(()=>{process.stdout.write(line.slice(40)+'\\n'+process.env.CU_FIXTURE_FINAL+'\\n');process.stderr.write(line+'\\n')},20)";
      writeFileSync(join(dir, 'launch.json'), JSON.stringify({
        runId: 'fixture', ownerToken: 'fixture', provider: 'codex', cwd: dir, stdinPath, stdoutLogPath, stderrLogPath,
        ownerMarkerPath: join(dir, 'owner.json'), exitMarkerPath: join(dir, 'exit.json'),
        deadlineAt: Date.now() + 10_000, timeoutMs: 10_000, command: [process.execPath, '-e', print],
      }));
      const runner = fileURLToPath(new URL('../scripts/lib/subagent/runner.ts', import.meta.url));
      const child = spawnSync('bun', [runner, dir], {
        env: { ...process.env, CU_FIXTURE_EVENT: privateEvent, CU_FIXTURE_FINAL: safe },
        timeout: 10_000, encoding: 'utf8',
      });
      expect(child.status, child.stderr).toBe(0);
      expect(readFileSync(stdoutLogPath, 'utf8')).toBe(redactCodexLog(privateEvent + '\n' + safe + '\n'));
      expect(readFileSync(stderrLogPath, 'utf8')).toBe(redactCodexLog(privateEvent + '\n'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes plain progress through immediately while waiting for the JSON record boundary', () => {
    let output = '';
    const stream = createCodexLogWriter(part => { output += part; });
    stream.write('ready');
    expect(output).toBe('ready');
    stream.write('\n{"type":"item.started"');
    expect(output).toBe('ready\n');
    stream.end();
    expect(output).toContain('omitted');
  });

  it('does not write partial, malformed or oversized JSON records', () => {
    const parts: string[] = [];
    const stream = createCodexLogWriter(part => parts.push(part), 128);
    stream.write('{"type":"item.started","private":"' + secret);
    expect(parts).toEqual([]);
    stream.write('x'.repeat(256) + '\n');
    stream.write('{"private":"' + secret);
    stream.end();
    expect(parts.join('')).not.toContain(secret);
    expect(parts.join('')).toContain('omitted');
  });

  it('keeps ordinary tool events byte-for-byte and protects code.run with an opaque result', () => {
    const ordinary = event('item.completed', 'fs.list', { path: 'example/' });
    expect(redactCodexLog(ordinary + '\r\n')).toBe(ordinary + '\r\n');
    const composed = event('item.completed', 'code.run', { code: secret }, { content: [{ text: secret }] });
    expect(redactCodexLog(composed)).not.toContain(secret);
  });
});
