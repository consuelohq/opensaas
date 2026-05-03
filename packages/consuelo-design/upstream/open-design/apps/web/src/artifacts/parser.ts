type ArtifactParserEvent =
  | {
      type: 'artifact:start';
      identifier: string;
      artifactType?: string;
      title: string;
    }
  | {
      type: 'artifact:chunk';
      identifier: string;
      artifactType?: string;
      title: string;
      delta: string;
    }
  | {
      type: 'artifact:end';
      fullContent: string;
    };

type ParserState = {
  active: boolean;
  content: string;
  identifier: string;
  artifactType?: string;
  title: string;
};

function extractAttribute(tag: string, name: string): string | undefined {
  const pattern = new RegExp(`${name}=["']([^"']*)["']`, 'i');
  const match = pattern.exec(tag);
  return match?.[1];
}

export function createArtifactParser() {
  const state: ParserState = {
    active: false,
    content: '',
    identifier: 'artifact',
    title: '',
  };

  return {
    feed(delta: string): ArtifactParserEvent[] {
      const events: ArtifactParserEvent[] = [];
      const startMatch = /<artifact\b[^>]*>/i.exec(delta);
      if (startMatch) {
        state.active = true;
        state.content = '';
        const tag = startMatch[0];
        state.identifier = extractAttribute(tag, 'identifier') ?? extractAttribute(tag, 'id') ?? 'artifact';
        state.artifactType = extractAttribute(tag, 'type');
        state.title = extractAttribute(tag, 'title') ?? '';
        events.push({
          type: 'artifact:start',
          identifier: state.identifier,
          artifactType: state.artifactType,
          title: state.title,
        });
      }

      if (!state.active) return events;

      const withoutStart = delta.replace(/<artifact\b[^>]*>/i, '');
      const endIndex = withoutStart.search(/<\/artifact>/i);
      const chunk = endIndex >= 0 ? withoutStart.slice(0, endIndex) : withoutStart;
      if (chunk.length > 0) {
        state.content += chunk;
        events.push({
          type: 'artifact:chunk',
          identifier: state.identifier,
          artifactType: state.artifactType,
          title: state.title,
          delta: chunk,
        });
      }
      if (endIndex >= 0) {
        state.active = false;
        events.push({ type: 'artifact:end', fullContent: state.content });
      }
      return events;
    },
    flush(): ArtifactParserEvent[] {
      if (!state.active) return [];
      state.active = false;
      return [{ type: 'artifact:end', fullContent: state.content }];
    },
  };
}
