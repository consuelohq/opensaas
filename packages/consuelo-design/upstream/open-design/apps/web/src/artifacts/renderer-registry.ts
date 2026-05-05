import type { ProjectFile } from '../types';
import { renderMarkdownToSafeHtml } from './markdown';

type RendererId =
  | 'html'
  | 'deck-html'
  | 'react-component'
  | 'markdown'
  | 'svg'
  | 'diagram'
  | 'code'
  | 'mini-app'
  | 'design-system';

type Renderer = { id: RendererId };
type ResolveInput = { file: ProjectFile; isDeckHint?: boolean };

const renderers: Record<RendererId, Renderer> = {
  html: { id: 'html' },
  'deck-html': { id: 'deck-html' },
  'react-component': { id: 'react-component' },
  markdown: { id: 'markdown' },
  svg: { id: 'svg' },
  diagram: { id: 'diagram' },
  code: { id: 'code' },
  'mini-app': { id: 'mini-app' },
  'design-system': { id: 'design-system' },
};

export const MarkdownRenderer = {
  id: 'markdown' as const,
  renderPartial: renderMarkdownToSafeHtml,
};

export const artifactRendererRegistry = {
  resolve({ file, isDeckHint }: ResolveInput): { renderer: Renderer } | null {
    const manifestRenderer = file.artifactManifest?.renderer;
    if (manifestRenderer && manifestRenderer in renderers) {
      return { renderer: renderers[manifestRenderer as RendererId] };
    }
    if (isDeckHint) return { renderer: renderers['deck-html'] };
    if (file.kind === 'html') return { renderer: renderers.html };
    if (file.kind === 'code' && /\.(tsx|jsx)$/.test(file.name)) return { renderer: renderers['react-component'] };
    if (file.kind === 'text' && file.name.toLowerCase().endsWith('.md')) return { renderer: renderers.markdown };
    if (file.kind === 'image' && file.name.toLowerCase().endsWith('.svg')) return { renderer: renderers.svg };
    return null;
  },
};
