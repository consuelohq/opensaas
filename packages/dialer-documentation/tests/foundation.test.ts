import { describe, expect, it } from 'bun:test';
import { extractTranslationSegments } from '../src/lib/translation/text';

describe('documentation foundation', () => {
  it('normalizes emphasis and code spans while retaining SDK punctuation', () => {
    expect(extractTranslationSegments('Use **ready reps**, *clear queues*, and `@consuelo/dialer_sdk` for calling.')).toEqual(['Use ready reps, clear queues, and @consuelo/dialer_sdk for calling.']);
  });
  it('requires an isolated preview origin before build or deploy', async () => {
    const { requirePreviewOrigin } = await import('../scripts/lib/preview-deploy.mjs');
    for (const origin of [undefined, '', 'not-a-url', 'https://docs.consuelohq.com', 'https://os.consuelohq.com/docs/', 'https://preview.example/path']) {
      expect(() => requirePreviewOrigin(origin)).toThrow();
    }
    expect(requirePreviewOrigin('https://dialer-preview.example/')).toBe('https://dialer-preview.example');
  });
});
