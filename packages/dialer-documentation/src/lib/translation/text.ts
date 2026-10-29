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

function removeFencedCode(source: string): string {
  let fence: { marker: string; length: number } | undefined;
  return source.split(/\r?\n/).map((line) => {
    if (fence) {
      const closing = line.trim();
      if (closing.length >= fence.length && [...closing].every((char) => char === fence!.marker)) fence = undefined;
      return '';
    }
    const opening = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
    if (opening) {
      fence = { marker: opening[1][0], length: opening[1].length };
      return '';
    }
    return line;
  }).join('\n');
}

export function extractTranslationSegments(rawMdx: string): string[] {
  const withoutMetadata = removeFencedCode(rawMdx)
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
  const text = segment
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
  return stripEmphasisOutsideCode(text);
}


function stripEmphasisOutsideCode(text: string): string {
  const strip = (prose: string) => prose
    .replace(/(\*\*|__)(?=\S)(.+?\S)\1/g, '$2')
    .replace(/(^|[\s(])([*_])(?=\S)(.+?\S)\2(?=$|[\s.,!?:;)])/g, '$1$3');
  let result = '';
  let cursor = 0;
  for (const span of text.matchAll(/(`+)([\s\S]*?)\1/g)) {
    result += strip(text.slice(cursor, span.index)) + span[2];
    cursor = span.index + span[0].length;
  }
  return result + strip(text.slice(cursor));
}
