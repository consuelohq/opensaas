import { describe, expect, it } from 'vitest';
import { formatTraceHoverPreview } from '../scripts/lib/trace-site-inspector/table-formatters';
import { SESSION_COLOR_TONES, sessionColorTone } from '../scripts/lib/trace-site-inspector/session-colors';

describe('Trace hover summaries', () => {
  it('surfaces a concise, non-redundant file path rather than raw input transport JSON', () => {
    const row = {
      name: 'fs.read',
      rawResolvedInputJson: { path: 'packages/os/scripts/lib/observability-traces-site.ts', full: true, json: true },
    };
    const tip = formatTraceHoverPreview(row, 'input', 'inspect source');
    expect(tip).toContain('packages/os/scripts/lib/observability-traces-site.ts');
    expect(tip).not.toContain('{"');
    expect(tip.length).toBeLessThan(190);
  });

  it('summarizes success response without dumping raw file contents', () => {
    const row = { name: 'fs.read', rawResultJson: { ok: true, code: 'OK', data: { content: '# Skills\\n' + 'source text '.repeat(2500) } } };
    const tip = formatTraceHoverPreview(row, 'output', 'read complete');
    expect(tip).toMatch(/chars|KB|returned|read/i);
    expect(tip.length).toBeLessThan(160);
    expect(tip).not.toContain('source text source text');
  });

  it('shows a short command or purpose without echoing full source code', () => {
    const row = { name: 'code.call', rawResolvedInputJson: { language: 'bun', mode: 'verify', code: 'const p = Bun.spawnSync({cmd: ["bun","test","packages/os/tests/test.ts"]});'.repeat(80) } };
    const tip = formatTraceHoverPreview(row, 'input', 'run verification');
    expect(tip.length).toBeLessThan(180);
    expect(tip).not.toContain('const p = Bun.spawnSync');
    expect(tip).toContain('bun');
    expect(tip).toContain('test');
  });

  it('peeks into the actual read target instead of stating the number of code characters', () => {
    const row = {
      name: 'code.call',
      rawResolvedInputJson: {
        language: 'bun', mode: 'read',
        code: 'const source=await Bun.file("packages/dialer-server/src/provider-metadata.test.ts").text(); process.stdout.write(source.slice(0, 500));',
      },
    };
    const tip = formatTraceHoverPreview(row, 'input', 'read provider-metadata.test.ts');
    expect(tip).toContain('packages/dialer-server/src/provider-metadata.test.ts');
    expect(tip).not.toMatch(/chars? of code/);
    expect(tip.length).toBeLessThan(200);
  });

  it('previews a known verification command with target file without dumping source text', () => {
    const row = {
      name: 'code.call',
      rawResolvedInputJson: {
        language: 'bun', mode: 'verify',
        code: "const p=Bun.spawnSync({cmd:['bun','test','tests/reviewed.test.ts']}); process.stdout.write(new TextDecoder().decode(p.stdout));",
      },
    };
    const tip = formatTraceHoverPreview(row, 'input', 'run bun test');
    expect(tip).toMatch(/bun test/);
    expect(tip).toContain('reviewed.test.ts');
    expect(tip).not.toContain('Bun.spawnSync');
  });

  it('redacts code secrets and refuses dangerous command content in ambient previews', () => {
    const row = {
      name: 'code.call',
      rawResolvedInputJson: {
        language: 'bun', mode: 'edit',
        code: 'const password="dontshow"; const privateKey="alsohide"; await Bun.write("src/safe.ts", "const jwt = secret");',
      },
    };
    const tip = formatTraceHoverPreview(row, 'input', 'edit files');
    expect(tip).toContain('src/safe.ts');
    for (const secret of ['dontshow','alsohide','secret','jwt','password'])
      expect(tip).not.toContain(secret);
  });

  it('uses a meaningful read-result heading when safe instead of mere character count', () => {
    const row = {
      name: 'fs.read',
      rawResultJson: {ok:true,data:{content:'# Provider metadata tests\n\nUnit tests for matching provider names.\n'}},
    };
    const tip = formatTraceHoverPreview(row, 'output', 'read complete');
    expect(tip).toContain('Provider metadata tests');
    expect(tip).not.toMatch(/^\s*Returned \d+ characters/);
  });

  it('omits hover for results without information beyond the table summary', () => {
    expect(formatTraceHoverPreview({ name:'other', rawResultJson:{ ok:true } }, 'output', 'command complete')).toBe('');
  });

  it('does not reveal sensitive transport fields in formatted tooltips', () => {
    const row = {name:'some.tool', rawResolvedInputJson:{apiKey:'private-secret-123', password:'dontshow', token:'sensitive-abc', path:'src/safe.ts'}};
    const tip = formatTraceHoverPreview(row, 'input', 'read safe');
    expect(tip).toContain('src/safe.ts');
    expect(tip).not.toContain('private-secret');
    expect(tip).not.toContain('dontshow');
    expect(tip).not.toContain('sensitive-abc');
  });
});

describe('Session color palette', () => {
  it('adds at least ten new muted semantic pairs while preserving original assignments', () => {
    expect(SESSION_COLOR_TONES.length).toBeGreaterThanOrEqual(25);
    expect(SESSION_COLOR_TONES[0]).toEqual({ dark: '#c87958', light: '#98543d' });
    expect(new Set(SESSION_COLOR_TONES.map((tone) => tone.dark)).size).toBe(SESSION_COLOR_TONES.length);
    for (const tone of SESSION_COLOR_TONES) {
      expect(tone.dark).toMatch(/^#[0-9a-f]{6}$/i);
      expect(tone.light).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(sessionColorTone('task/os/session-id')).toEqual(sessionColorTone('task/os/session-id'));
  });

  it('reaches the full palette across distinct sessions while keeping repeat calls the same shade', () => {
    const sessions = Array.from({length:250},(_,i)=> 'task/dialer/approved-script-matching-session-' + i);
    const assigned = sessions.map(s => sessionColorTone(s)?.dark);
    expect(new Set(assigned).size).toBe(SESSION_COLOR_TONES.length);
    expect(sessionColorTone(sessions[5])).toEqual(sessionColorTone(sessions[5]));
  });
});
