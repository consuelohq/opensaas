import type { JsonValue } from '@open-design/contracts';
import type { ArtifactManifest } from './types';

const MANIFEST_VERSION = 1 as const;


type ManifestOptions = {
  entry: string;
  title?: string;
  sourceSkillId?: string;
  designSystemId?: string | null;
  metadata?: Record<string, JsonValue | undefined>;
};

export function createHtmlArtifactManifest(options: ManifestOptions): ArtifactManifest {
  const lower = options.entry.toLowerCase();
  const isDeck = lower.includes('deck') || lower.includes('slides') || lower.includes('pitch');
  return {
    version: MANIFEST_VERSION,
    kind: isDeck ? 'deck' : 'html',
    title: options.title || options.entry,
    entry: options.entry,
    renderer: isDeck ? 'deck-html' : 'html',
    status: 'complete',
    exports: isDeck ? ['html', 'pdf', 'pptx', 'zip'] : ['html', 'pdf', 'zip'],
    sourceSkillId: options.sourceSkillId,
    designSystemId: options.designSystemId ?? undefined,
    metadata: options.metadata,
  };
}

export function inferLegacyManifest(options: ManifestOptions): ArtifactManifest | null {
  const lower = options.entry.toLowerCase();
  const isDeck = lower.endsWith('.html') && (lower.includes('deck') || lower.includes('slides') || lower.includes('pitch'));

  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return {
      version: MANIFEST_VERSION,
      kind: isDeck ? 'deck' : 'html',
      title: options.title || options.entry,
      entry: options.entry,
      renderer: isDeck ? 'deck-html' : 'html',
      status: 'complete',
      exports: isDeck ? ['html', 'pdf', 'pptx', 'zip'] : ['html', 'pdf', 'zip'],
      sourceSkillId: options.sourceSkillId,
      designSystemId: options.designSystemId ?? undefined,
      metadata: { inferred: true, ...options.metadata },
    };
  }

  if (lower.endsWith('.md')) {
    return {
      version: MANIFEST_VERSION,
      kind: 'markdown-document',
      title: options.title || options.entry,
      entry: options.entry,
      renderer: 'markdown',
      status: 'complete',
      exports: ['md', 'html', 'pdf', 'zip'],
      sourceSkillId: options.sourceSkillId,
      designSystemId: options.designSystemId ?? undefined,
      metadata: { inferred: true, ...options.metadata },
    };
  }

  if (lower.endsWith('.svg')) {
    return {
      version: MANIFEST_VERSION,
      kind: 'svg',
      title: options.title || options.entry,
      entry: options.entry,
      renderer: 'svg',
      status: 'complete',
      exports: ['svg', 'zip'],
      sourceSkillId: options.sourceSkillId,
      designSystemId: options.designSystemId ?? undefined,
      metadata: { inferred: true, ...options.metadata },
    };
  }

  return null;
}
