const path = 'packages/workspace/tests/tool-manifest.test.ts';
const text = await Bun.file(path).text();
const lines = text.split('\n');
const lineSpans = [{ from: 1, to: 12 }];
const snippets = lineSpans.map((span) => ({
  ...span,
  text: lines.slice(span.from - 1, span.to).join('\n'),
}));

console.log(JSON.stringify({
  ok: true,
  path,
  lineSpans,
  snippets,
}, null, 2));
