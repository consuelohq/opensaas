import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { executeTool } from '../scripts/lib/facade/executor';
import { createProviderLogWriter, redactProviderLog } from '../scripts/lib/subagent/computer-use-log';

const secret = 'synthetic-ui-marker';
function event(type: string, tool: string, input: unknown, result?: unknown) {
  return JSON.stringify({ type, item: { id: 'item-one', type: 'mcp_tool_call', server: 'os', tool: 'call',
    arguments: { tool, input }, result, error: result ? { message: secret } : undefined } });
}

describe('provider computer-use logs', () => {
  it('keeps private Pi MCP events out of persisted stdout, stderr and summaries', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cu-pi-log-'));
    try {
      const input = { tool: 'computer.use', input: { action: 'fill', text: secret } };
      const call = { id: 'private-1', type: 'toolCall', name: 'os_call', arguments: input };
      const toolResult = { role: 'toolResult', toolName: 'os_call', toolCallId: call.id, content: [{ type: 'text', text: secret }] };
      const records = [
        { type: 'message_update', assistantMessageEvent: { type: 'toolcall_delta', delta: secret } },
        { type: 'message_end', message: { role: 'assistant', content: [call] } },
        { type: 'tool_execution_start', toolName: call.name, toolCallId: call.id, args: input },
        { type: 'tool_execution_end', toolCallId: call.id, result: toolResult },
        { type: 'agent_end', messages: [toolResult] },
        { type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'finished' }], usage: { input: 10, output: 2 } } },
      ].map(record => JSON.stringify(record)).join('\n');
      const pi = join(dir, 'fixture-pi');
      writeFileSync(pi, '#!/usr/bin/env node\nprocess.stdout.write(process.env.CU_PI_EVENTS);process.stderr.write(process.env.CU_PI_EVENTS);', { mode: 0o700 });
      const instructionPath = join(dir, 'instruction.md');
      writeFileSync(instructionPath, 'Run the fixture.');
      const response = await executeTool('subagent', { provider: 'pi', policy: 'read', instructionPath }, {
        cwd: dir, env: { ...process.env, CONSUELO_HOME: dir, WORKSPACE_SUBAGENT_PI_BIN: pi,
          WORKSPACE_SUBAGENT_PI_MCP_CONFIG: join(dir, 'mcp.json'), CU_PI_EVENTS: records }, logMode: 'silent',
      });
      expect(response.ok, response.message).toBe(true);
      const data = response.data as { finalMessage: string; stdoutLogPath: string; stderrLogPath: string; usage: { outputTokens: number } };
      expect(data.finalMessage).toBe('finished');
      expect(data.usage.outputTokens).toBe(2);
      for (const path of [data.stdoutLogPath, data.stderrLogPath]) expect(readFileSync(path, 'utf8')).not.toContain(secret);
      expect(JSON.stringify(response.data)).not.toContain(secret);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('removes private tool input and output from buffered and split streaming records', () => {
    const ordinary = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'finished' } });
    const source = [
      event('item.started', 'batch', { steps: [{ tool: 'computer.use', input: { text: secret } }] }),
      event('item.completed', 'batch', { steps: [{ tool: 'computer.use' }] }, { snapshot: secret }),
      ordinary,
    ].join('\n') + '\n';
    let out = '';
    const stream = createProviderLogWriter(part => { out += part; });
    for (let i = 0; i < source.length; i += 7) stream.write(source.slice(i, i + 7));
    stream.end();
    expect(out).toBe(redactProviderLog(source));
    expect(out).not.toContain(secret);
    expect(out).toContain(ordinary);
    expect(JSON.parse(out.split('\n')[1]).item.arguments.tool).toBe('batch');
  });

  it.each([true, false])('sanitizes durable logs with explicit provider metadata=%s', explicitProvider => {
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
      const executable = explicitProvider ? process.execPath : join(dir, 'codex.exe');
      if (!explicitProvider) copyFileSync(process.execPath, executable);
      writeFileSync(join(dir, 'launch.json'), JSON.stringify({
        runId: 'fixture', ownerToken: 'fixture', provider: explicitProvider ? 'codex' : undefined, cwd: dir, stdinPath, stdoutLogPath, stderrLogPath,
        ownerMarkerPath: join(dir, 'owner.json'), exitMarkerPath: join(dir, 'exit.json'),
        deadlineAt: Date.now() + 10_000, timeoutMs: 10_000, command: [executable, '-e', print],
      }));
      const runner = fileURLToPath(new URL('../scripts/lib/subagent/runner.ts', import.meta.url));
      const child = spawnSync('bun', [runner, dir], {
        env: { ...process.env, CU_FIXTURE_EVENT: privateEvent, CU_FIXTURE_FINAL: safe },
        timeout: 10_000, encoding: 'utf8',
      });
      expect(child.status, child.stderr).toBe(0);
      expect(readFileSync(stdoutLogPath, 'utf8')).toBe(redactProviderLog(privateEvent + '\n' + safe + '\n'));
      expect(readFileSync(stderrLogPath, 'utf8')).toBe(redactProviderLog(privateEvent + '\n'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('filters OpenCode tool parts and complete multiline Grok documents while preserving ordinary output', () => {
    const part = { type: 'tool', tool: 'mcp__os__call', state: { input: { tool: 'computer-use', input: { text: secret } }, output: secret } };
    const openCode = JSON.stringify({ type: 'tool_use', part });
    expect(redactProviderLog(openCode)).not.toContain(secret);
    const normal = JSON.stringify({ message: 'finished', stopReason: 'completed' }, null, 2);
    const grok = JSON.stringify({ messages: [part] }, null, 2);
    const emitted: string[] = [];
    const writer = createProviderLogWriter(chunk => emitted.push(chunk), 8192, true);
    const stream = grok + '\n' + normal + '\n[ready] waiting\n';
    for (let i = 0; i < stream.length; i += 5) writer.write(stream.slice(i, i + 5));
    writer.end();
    expect(emitted.join('')).not.toContain(secret);
    expect(emitted.join('')).toContain(normal + '\n[ready] waiting');
  });

  it('passes plain progress through immediately while waiting for the JSON record boundary', () => {
    let output = '';
    const stream = createProviderLogWriter(part => { output += part; });
    stream.write('ready');
    expect(output).toBe('ready');
    stream.write('\n{"type":"item.started"');
    expect(output).toBe('ready\n');
    stream.end();
    expect(output).toContain('omitted');
  });

  it('does not write partial, malformed or oversized JSON records', () => {
    const parts: string[] = [];
    const stream = createProviderLogWriter(part => parts.push(part), 128);
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
    expect(redactProviderLog(ordinary + '\r\n')).toBe(ordinary + '\r\n');
    const composed = event('item.completed', 'code.run', { code: secret }, { content: [{ text: secret }] });
    expect(redactProviderLog(composed)).not.toContain(secret);
  });
});
