const frontmatterPattern = /^---\s*[\s\S]*?---\s*/;
const importPattern = /^import\s.+$/gm;
const exportPattern = /^export\s.+$/gm;
const jsxTagPattern = /<\/?[A-Z][^>]*>/g;
const htmlCommentPattern = /<!--[\s\S]*?-->/g;
const mdxExpressionPattern = /{[^{}]+}/g;
const markdownLinkPattern = /\[([^\]]+)\]\([^)]+\)/g;
const imagePattern = /!\[[^\]]*\]\([^)]+\)/g;
const headingMarkerPattern = /^#{1,6}\s+/;
const listMarkerPattern = /^\s*[-*+]\s+/;
const orderedListMarkerPattern = /^\s*\d+\.\s+/;

export function extractTranslationSegments(rawMdx: string): string[] {
  const withoutMetadata = rawMdx
    .replace(frontmatterPattern, '')
    .replace(importPattern, '')
    .replace(exportPattern, '')
    .replace(htmlCommentPattern, '')
    .replace(imagePattern, '')
    .replace(jsxTagPattern, '\n')
    .replace(mdxExpressionPattern, ' ')
    .replace(markdownLinkPattern, '$1');

  return withoutMetadata
    .split(/\n{2,}/)
    .map((segment) => cleanSegment(segment))
    .filter((segment) => segment.length >= 16)
    .slice(0, 80);
}

function cleanSegment(segment: string): string {
  return segment
    .split('\n')
    .map((line) => line
      .replace(headingMarkerPattern, '')
      .replace(listMarkerPattern, '')
      .replace(orderedListMarkerPattern, '')
      .trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
