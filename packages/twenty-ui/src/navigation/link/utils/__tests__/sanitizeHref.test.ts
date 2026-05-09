import { isHrefContentValid, sanitizeHref } from '../sanitizeHref';

describe('sanitizeHref', () => {
  it.each([
    ['https://consuelohq.com'],
    ['http://consuelohq.com'],
    ['mailto:support@consuelohq.com'],
    ['/settings/profile'],
    ['settings/profile'],
    ['#section'],
  ])('should keep safe href %s', (href) => {
    expect(isHrefContentValid(href)).toBe(true);
    expect(sanitizeHref(href)).toBe(href);
  });

  it.each([
    ['javascript:alert(1)'],
    ['JavaScript:alert(1)'],
    [' data:text/html,<script>alert(1)</script>'],
    ['\n\tvbscript:msgbox(1)'],
  ])('should remove dangerous href %s', (href) => {
    expect(isHrefContentValid(href)).toBe(false);
    expect(sanitizeHref(href)).toBe('');
  });

  it.each([undefined, null])('should remove missing href %s', (href) => {
    expect(isHrefContentValid(href)).toBe(false);
    expect(sanitizeHref(href)).toBe('');
  });
});
