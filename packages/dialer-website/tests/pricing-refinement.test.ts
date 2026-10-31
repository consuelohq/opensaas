import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), 'utf8');
describe('pricing purchase and reading experience', () => {
  it('opens pricing answers together without changing the home accordion', () => {
    const html = read('dist/pricing/index.html');
    const faq = html.split('id="pricing-faq"')[1].split('</section>')[0];
    expect((faq.match(/<details[^>]* open/g) ?? []).length).toBe(10);
    expect(faq).toContain('data-faq-independent');
    expect(read('dist/index.html')).not.toMatch(
      /<div[^>]*data-faq-independent/,
    );
  });
  it('offers a real purchase selection for teams and Mercury instead of email', () => {
    const html = read('dist/pricing/index.html');
    expect(html).toContain('data-team-checkout');
    expect(html).toContain('$25');
    expect(html).not.toContain('mailto:');
    expect(html).not.toContain('Start with a few calls.');
  });
  it('renders real image assets including the requested agent tools inside the white frame', () => {
    const html = read('dist/pricing/index.html');
    for (const name of ['OpenAI', 'Claude', 'OpenCode', 'Pi'])
      expect(html).toContain('alt="' + name + '"');
    expect(html).not.toContain('data-logo-step');
    expect(html).toContain('data-logo-carousel');
    expect(html.indexOf('data-logo-carousel')).toBeLessThan(
      html.indexOf('data-cloud-reveal'),
    );
  });
});
