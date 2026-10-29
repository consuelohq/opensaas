import { describe, expect, it } from 'vitest';
import {
  renderInspectorReading,
  formatTokenCount,
} from '../scripts/lib/trace-site-inspector/reading-view';
import { formatTraceTableRow } from '../scripts/lib/trace-site-inspector/table-formatters';
import {
  traceTokenUsage,
  branchName,
} from '../scripts/lib/trace-site-inspector/model';
import { sanitizeTraceHistoryRowForTest } from '../scripts/lib/trace-sites-local-read-backend';

const call = (name: string, input: unknown, output: unknown) => ({
  name,
  ok: true,
  status: 'success',
  code: 'OK',
  rawInputJson: JSON.stringify(input),
  rawResultJson: JSON.stringify({
    now: '2026-10-29',
    ok: true,
    code: 'OK',
    message: 'command completed',
    data: output,
    traceId: 'trc_hidden',
    durationMs: 100,
  }),
});
describe('tool-aware trace reading', () => {
  it('shows expanded input above output on one page and collapses secondary metadata', () => {
    const html = renderInspectorReading(
      call(
        'fs.read',
        {
          files: [
            { path: 'src/one.ts', from: 5, to: 10 },
            { path: 'src/two.ts' },
          ],
          filesJson: 'duplicate',
        },
        { content: 'HELLO FILE', path: 'src/one.ts' },
      ),
      'input',
    );
    expect(html.indexOf('data-ti-section="input"')).toBeLessThan(
      html.indexOf('data-ti-section="output"'),
    );
    expect(html).not.toContain('role="tab"');
    expect(html).toContain('src/one.ts');
    expect(html).toContain('src/two.ts');
    expect(html).toContain('HELLO FILE');
    expect(html).not.toContain('<dt>filesJson</dt>');
    expect(html.split('<details class="tiDiagnostics"')[0]).not.toContain(
      '<dt>ok</dt>',
    );
    expect(html.split('<details class="tiDiagnostics"')[0]).not.toContain(
      '<dt>code</dt>',
    );
    expect(html).toContain('<details class="tiDiagnostics"');
    expect(html).not.toContain('<details class="tiDiagnostics" open');
  });
  it('renders captured steering Markdown as a readable document and escapes embedded HTML', () => {
    const html = renderInspectorReading(
      call(
        'get_steering',
        {},
        {
          content:
            '# Workspace rules\n\nRead **the source**.\n\n- One\n- Two\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))',
          decision: 'full',
        },
      ),
      'input',
    );
    expect(html).toContain('<h1>Workspace rules</h1>');
    expect(html).toContain('<strong>the source</strong>');
    expect(html).toContain('<li>One</li>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
  });
  it('explains missing historical steering instead of substituting current steering', () => {
    expect(
      renderInspectorReading(
        call(
          'get_steering',
          {},
          { decision: 'full', chars: 900, message: 'steering loaded' },
        ),
        'input',
      ),
    ).toContain('was not saved');
  });
  it('opens useful tool-search and explorer results with descriptive headings', () => {
    for (const name of ['tools.search', 'explore']) {
      const html = renderInspectorReading(
        call(
          name,
          { query: 'routing' },
          {
            results: [
              {
                name: 'fs.read',
                path: 'src/routes.ts',
                symbol: 'routeRequest',
                description: 'Read a file',
                preview: 'function routeRequest() {}',
              },
            ],
            policy: { readiness: 'gathering' },
          },
        ),
        'input',
      );
      expect(html).toContain('routing');
      expect(html).toContain('routeRequest');
      expect(html).not.toContain('<dt>0</dt>');
      expect(html).toContain('tiResultCard');
    }
  });
  it('keeps meaningful domain fields and exposes nested error details', () => {
    const row = call(
      'github',
      { operation: 'raw', reason: 'Inspect the failing job' },
      {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Cannot find workflow 42',
        reason: 'Workflow removed',
        packet: { details: { error: 'No workflow' } },
      },
    );
    row.ok = false;
    row.status = 'error';
    row.code = 'NOT_FOUND';
    const html = renderInspectorReading(row, 'input');
    expect(html).toContain('Cannot find workflow 42');
    expect(html).toContain('Inspect the failing job');
    expect(html).toContain('No workflow');
    expect(html).toContain('role="alert"');
  });
  it('shows browser action and URL together and preserves complete source content', () => {
    const html = renderInspectorReading(
      call(
        'browser.open',
        { url: 'https://example.com' },
        {
          raw: 'url: https://example.com\ntitle: Example\nscreenshot: /tmp/page.png\n- heading Example',
        },
      ),
      'input',
    );
    expect(html).toContain('https://example.com');
    expect(html).toContain('Example');
    expect(html).toContain('/tmp/page.png');
  });
  it('formats recorded tokens as whole counts and never synthesizes missing usage', () => {
    expect(
      formatTokenCount(
        traceTokenUsage({ inputTokens: 1234, outputTokens: 567 }).total,
      ),
    ).toBe('1,801');
    expect(
      traceTokenUsage({
        rawInputJson: 'x'.repeat(400),
        rawResultJson: 'y'.repeat(200),
      }).total.value,
    ).toBeNull();
    expect(formatTokenCount({ value: 100, estimated: true })).toBe('—');
    expect(formatTokenCount(traceTokenUsage({ totalTokens: 0 }).total)).toBe(
      '0',
    );
  });
});
describe('specific main-table summaries and session identity', () => {
  it('summarizes structured and serialized multiple-file reads without object coercion', () => {
    for (const input of [
      { files: [{ path: 'src/a.ts', from: 1, to: 4 }, { path: 'src/b.ts' }] },
      {
        filesJson: JSON.stringify([{ path: 'src/a.ts' }, { path: 'src/b.ts' }]),
      },
    ]) {
      const label = formatTraceTableRow(call('fs.read', input, {})).inputLabel;
      expect(label).toBe('read 2 files · a.ts, b.ts');
    }
  });
  it.each([
    [
      'python',
      "paths=['src/a.ts','src/b.ts']\nfor p in paths:\n print(Path(p).read_text())",
      ['a.ts', 'b.ts'],
    ],
    ['python', "p = 'src/routes.ts'\nprint(open(p).read())", ['routes.ts']],
    [
      'bash',
      "sed -n '10,40p' src/routes.ts\ncat docs/README.md",
      ['routes.ts', 'README.md'],
    ],
    [
      'bun',
      "const files=['src/a.ts','src/b.ts']; for (const p of files) process.stdout.write(await Bun.file(p).text());",
      ['a.ts', 'b.ts'],
    ],
    [
      'python',
      "import subprocess\nfor args in [['git','diff','--stat'],['rg','-n','routing','src']]:\n subprocess.run(args)",
      ['git diff', 'routing'],
    ],
    [
      'bun',
      "const p=Bun.spawnSync({cmd:['rg','-n','routing','src'],stdout:'pipe'});",
      ['routing'],
    ],
  ])(
    'extracts real subjects from %s code without executing it',
    (language, code, subjects) => {
      const label = formatTraceTableRow(
        call('code.call', { language, mode: 'read', code }, {}),
      ).inputLabel;
      for (const subject of subjects) expect(label).toContain(subject);
      expect(label).not.toContain('inspect source');
    },
  );
  it('recovers task labels from captured invocation context without conflating a work session', () => {
    const row = sanitizeTraceHistoryRowForTest({
      rowid: 1,
      tool: 'server',
      task_session: 'tsk_old',
      branch: '',
      resolved_input_json: JSON.stringify({
        branch: 'task/website/read-docs',
        taskSession: 'tsk_old',
      }),
    });
    expect(branchName(row)).toBe('task/website/read-docs');
    expect(row.taskSession).toBe('tsk_old');
  });
});
describe('historical task labels across page boundaries', () => {
  it('uses a unique label for the same persisted task session, never a nearby unrelated task', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { openTraceDatabase, ensureToolTraceSchema } =
      await import('../scripts/lib/trace-database-schema');
    const { createLocalTraceSitesReadBackend } =
      await import('../scripts/lib/trace-sites-local-read-backend');
    const dir = mkdtempSync(join(tmpdir(), 'trace-identity-'));
    try {
      const dbPath = join(dir, 'traces.db');
      const db = openTraceDatabase(dbPath);
      ensureToolTraceSchema(db);
      const insert = db.query(
        "INSERT INTO tool_traces (id,ts,trace_id,task_session,branch,tool,source,status,ok) VALUES(?,'2026-10-29T00:00:00Z',?,?,?,?,'test','succeeded',1)",
      );
      insert.run(
        'a',
        'trc_a',
        'tsk_same',
        'task/website/readable-name',
        'code.call',
      );
      insert.run(
        'b',
        'trc_b',
        'tsk_other',
        'task/other/unrelated',
        'code.call',
      );
      insert.run('c', 'trc_c', 'tsk_same', '', 'fs.read');
      db.close();
      const page = await createLocalTraceSitesReadBackend({ dbPath })
        .readHistoryPage!({
        workspaceId: 'wrk_test',
        workspaceHost: 'test.example',
        site: 'trace-burn-intelligence',
        sourceMode: 'local-networked',
        cursor: 'latest',
        limit: 1,
      });
      expect(page.rows).toHaveLength(1);
      expect(branchName(page.rows[0])).toBe('task/website/readable-name');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
describe('representative common tool results', () => {
  const examples = [
    [
      'fs.read',
      {
        path: 'src/routes.ts',
      },
      {
        path: 'src/routes.ts',
        content: 'function routeRequest() {}',
      },
      'routeRequest',
    ],
    [
      'fs.write',
      {
        path: 'docs/plan.md',
        content: 'Plan',
      },
      {
        path: 'docs/plan.md',
        written: true,
      },
      'plan.md',
    ],
    [
      'fs.apply_patch',
      {
        patchText: '*** Update File: src/routes.ts\n+fix',
      },
      {
        files: ['src/routes.ts'],
      },
      'routes.ts',
    ],
    [
      'fs.list',
      {
        path: 'src',
      },
      {
        entries: [
          {
            name: 'routes.ts',
            type: 'file',
          },
        ],
      },
      'routes.ts',
    ],
    [
      'tools.search',
      {
        query: 'files',
      },
      {
        results: [
          {
            name: 'fs.read',
            description: 'Read captured source',
          },
        ],
      },
      'captured source',
    ],
    [
      'explore',
      {
        query: 'routing',
      },
      {
        results: [
          {
            path: 'src/routes.ts',
            symbol: 'routeRequest',
            preview: 'The routing implementation',
          },
        ],
      },
      'routing implementation',
    ],
    [
      'get_steering',
      {},
      {
        content: '# Runtime guidance\n\nCaptured at execution.',
      },
      'Captured at execution',
    ],
    [
      'github',
      {
        operation: 'pr.view',
        pr: 42,
      },
      {
        summary: {
          pr: {
            title: 'Fix routing',
            number: 42,
            state: 'OPEN',
          },
        },
        packet: {
          details: {
            checks: [
              {
                name: 'build',
                state: 'success',
              },
            ],
          },
        },
      },
      'Fix routing',
    ],
    [
      'github',
      {
        operation: 'pr.checks',
        pr: 42,
      },
      {
        summary: {
          passed: 3,
        },
        packet: {
          details: {
            jobs: [
              {
                name: 'unit tests',
                state: 'success',
              },
            ],
          },
        },
      },
      'unit tests',
    ],
    [
      'github',
      {
        operation: 'raw',
        reason: 'Inspect job failure',
      },
      {
        summary: {
          text: 'Job failed at build step',
        },
      },
      'Job failed',
    ],
    [
      'browser.open',
      {
        url: 'https://example.test',
      },
      {
        raw: 'url: https://example.test\ntitle: Captured page\nscreenshot: /tmp/capture.png',
      },
      'Captured page',
    ],
    [
      'browser.snap',
      {},
      {
        raw: '- heading Captured browser content',
      },
      'Captured browser content',
    ],
    [
      'browser.click',
      {
        ref: 'e12',
      },
      {
        raw: 'Clicked Submit button',
      },
      'Submit button',
    ],
    [
      'browser.eval',
      {
        js: 'document.title',
      },
      {
        result: 'Captured title',
      },
      'Captured title',
    ],
    [
      'code.call',
      {
        language: 'python',
        mode: 'read',
        code: 'print(1)',
      },
      {
        stdout: 'Captured command output',
        exitCode: 0,
      },
      'Captured command output',
    ],
    [
      'code.run',
      {
        code: 'return workspace.status({})',
      },
      {
        result: {
          summary: 'Captured workspace status',
        },
      },
      'Captured workspace status',
    ],
    [
      'mac.call',
      {
        command: 'sw_vers',
      },
      {
        stdout: 'Captured operating system',
      },
      'Captured operating system',
    ],
    [
      'batch',
      {
        steps: [
          {
            tool: 'fs.read',
            input: {
              path: 'README.md',
            },
          },
        ],
      },
      {
        results: [
          {
            tool: 'fs.read',
            ok: true,
            code: 'OK',
            data: {
              content: 'Captured batch file',
            },
          },
        ],
      },
      'Captured batch file',
    ],
    [
      'review.run',
      {
        base: 'origin/main',
      },
      {
        summary: {
          blockingIssues: 0,
        },
        issues: [
          {
            message: 'Review recommendation',
          },
        ],
      },
      'Review recommendation',
    ],
    [
      'verify',
      {
        base: 'origin/main',
      },
      {
        suites: [
          {
            name: 'Unit tests',
            status: 'passed',
          },
        ],
      },
      'Unit tests',
    ],
    [
      'task.push',
      {
        message: 'Fix routing',
      },
      {
        branch: 'task/os/fix',
        message: 'Pushed fix',
      },
      'Pushed fix',
    ],
    [
      'task.pr',
      {},
      {
        stream: 'stream/os',
        prUrl: 'https://github.com/example/repo/pull/42',
      },
      'pull/42',
    ],
    [
      'task.finish',
      {},
      {
        message: 'Task finished',
        removedWorktree: '/tmp/worktree',
      },
      'Task finished',
    ],
    [
      'session.start',
      {
        kind: 'task',
        title: 'Improve tracing',
      },
      {
        branch: 'task/os/improve-tracing',
        worktreePath: '/tmp/tracing',
      },
      'improve-tracing',
    ],
    [
      'stream.context',
      {
        area: 'os',
      },
      {
        stream: 'stream/os',
        recentCommits: ['Fix trace page'],
      },
      'Fix trace page',
    ],
    [
      'lifecycle.status',
      {},
      {
        result: {
          version: '0.1.140',
          installState: 'valid',
        },
      },
      '0.1.140',
    ],
    [
      'lifecycle.update',
      {
        channel: 'canary',
      },
      {
        result: {
          resultingVersion: '0.1.140',
        },
      },
      '0.1.140',
    ],
    [
      'server',
      {
        action: 'status',
      },
      {
        raw: 'Server running; two workers ready',
      },
      'two workers ready',
    ],
    [
      'git.diff',
      {
        base: 'origin/main',
      },
      {
        files: [
          {
            path: 'src/routes.ts',
            additions: 3,
          },
        ],
        patch: '+ routing fix',
      },
      'routing fix',
    ],
    [
      'linear.issue',
      {
        id: 'DEV-42',
      },
      {
        identifier: 'DEV-42',
        title: 'Fix tracing',
        description: 'Captured issue context',
      },
      'Captured issue context',
    ],
    [
      'linear.updateIssue',
      {
        id: 'DEV-42',
        status: 'Done',
      },
      {
        identifier: 'DEV-42',
        title: 'Finished tracing fix',
      },
      'Finished tracing fix',
    ],
    [
      'linear.createIssue',
      {
        title: 'Trace follow-up',
      },
      {
        identifier: 'DEV-43',
        title: 'Trace follow-up',
      },
      'Trace follow-up',
    ],
    [
      'wait',
      {
        seconds: 4,
        reason: 'Check build',
      },
      {
        message: 'Build ready',
      },
      'Build ready',
    ],
    [
      'memory',
      {
        query: 'routing',
      },
      {
        results: [
          {
            title: 'Routing notes',
            content: 'Captured historical decision',
          },
        ],
      },
      'Captured historical decision',
    ],
  ];
  it.each(examples)(
    'keeps useful %s data readable',
    (name, input, output, expected) => {
      const html = renderInspectorReading(
        call(String(name), input, output),
        'input',
      );
      const visible = html.split('<details class="tiDiagnostics"')[0];
      expect(visible).toContain(String(expected));
      expect(visible).not.toContain('command completed');
      expect(visible).not.toContain('[object Object]');
    },
  );
});

describe('unambiguous summaries', () => {
  it('distinguishes similarly named files and preserves mixed workpad reads', () => {
    const row = call(
      'fs.read',
      {
        files: [
          { path: 'skills/task/SKILL.md' },
          { path: 'skills/browser/SKILL.md' },
        ],
      },
      {},
    );
    expect(formatTraceTableRow(row).inputLabel).toBe(
      'read 2 files · task/SKILL.md, browser/SKILL.md',
    );
    const mixed = call(
      'code.call',
      {
        language: 'python',
        mode: 'read',
        code: "paths=['.task/workpad.md','src/routes.ts']\nfor p in paths: print(Path(p).read_text())",
      },
      {},
    );
    expect(formatTraceTableRow(mixed).toolLabel).toBe('python.read');
    expect(formatTraceTableRow(mixed).inputLabel).toContain('routes.ts');
  });
  it('summarizes captured GitHub subjects and found tools instead of generic completion', () => {
    expect(
      formatTraceTableRow(
        call(
          'github',
          { operation: 'pr.view', pr: 42 },
          {
            summary: {
              pr: { number: 42, title: 'Improve tracing', state: 'OPEN' },
            },
          },
        ),
      ).outputLabel,
    ).toContain('Improve tracing');
    expect(
      formatTraceTableRow(
        call(
          'tools.search',
          { query: 'files' },
          { results: [{ name: 'fs.read' }, { name: 'fs.write' }] },
        ),
      ).outputLabel,
    ).toBe('2 tools found');
  });
});
