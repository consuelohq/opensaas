import { describe, it, expect } from 'bun:test';
import { readScriptFile } from './coaching-scripts';
describe('script import', () => {
  it('loads a bounded text/Markdown playbook and rejects unsupported or empty files', async () => {
    expect(
      await readScriptFile(new File(['Opening\nQuestions'], 'Discovery.md')),
    ).toEqual({ title: 'Discovery', content: 'Opening\nQuestions' });
    for (const file of [
      new File(['pdf'], 'script.pdf'),
      new File([''], 'empty.txt'),
      new File(['x'.repeat(100001)], 'large.txt'),
      new File(['bad\0text'], 'bad.md'),
    ])
      await expect(readScriptFile(file)).rejects.toThrow();
  });
});
