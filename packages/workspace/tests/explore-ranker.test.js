import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getQuerySignals, scoreCandidate } = require('../scripts/lib/search/ranker.js');

function baseContext(query) {
  return {
    changedPaths: new Set(),
    edgeCounts: new Map(),
    graphQualityScores: new Map(),
    query,
    querySignals: getQuerySignals(query),
    recentPaths: new Set(),
    recencyByPath: new Map(),
  };
}

function candidate(overrides = {}) {
  return {
    path: 'packages/workspace/scripts/unknown.js',
    bestChunkName: 'unknown',
    bestChunkType: 'block',
    embeddingSimilarity: 0.95,
    fileSize: 1000,
    hasClassOrFunction: false,
    implementationNames: '',
    preview: 'generic helper code',
    totalChunks: 1,
    typeExportChunkRatio: 0,
    ...overrides,
  };
}

describe('explore ranker relevance signals', () => {
  it('extracts issue IDs and tool names as anchors', () => {
    const signals = getQuerySignals('DEV-1508 research.ingest Groq transcript');

    expect(signals.issueIds).toContain('dev-1508');
    expect(signals.hardAnchors).toContain('dev-1508');
    expect(signals.hardAnchors).toContain('research.ingest');
    expect(signals.softAnchors).toContain('groq');
  });

  it('caps issue queries when candidates miss the issue anchor', () => {
    const scored = scoreCandidate(candidate({
      path: 'tests/postman/consuelo.postman_collection.json',
      bestChunkName: 'item part 8',
      preview: 'pm.test("Response time is acceptable")',
    }), baseContext('DEV-1508 dialer Groq transcript'));

    expect(scored.score).toBeLessThanOrEqual(0.38);
    expect(scored.parts.capReason).toBe('issue-anchor-missing');
    expect(scored.parts.semanticOnly).toBe(true);
  });

  it('rewards lexical path and symbol evidence over semantic-only matches', () => {
    const query = 'test selection registry changed file packages/dialer/src/dialer.ts selects dialer specs';
    const relevant = scoreCandidate(candidate({
      path: 'packages/workspace/scripts/test-selection.js',
      bestChunkName: 'test selection registry',
      bestChunkType: 'function',
      hasClassOrFunction: true,
      implementationNames: 'test selection registry changed file dialer specs',
      preview: 'selects suites for changed files and explicit rules',
    }), baseContext(query));
    const generic = scoreCandidate(candidate({
      path: 'packages/twenty-ui/src/testing/ComponentStorybookLayout.tsx',
      bestChunkName: 'imports',
      bestChunkType: 'import',
      preview: 'import styled from emotion',
    }), baseContext(query));

    expect(relevant.score).toBeGreaterThan(generic.score);
    expect(relevant.parts.lexicalScore).toBeGreaterThan(generic.parts.lexicalScore);
  });

  it('does not penalize explicit Open Design Electron queries as noisy vendored results', () => {
    const scored = scoreCandidate(candidate({
      path: 'packages/consuelo-design/upstream/open-design/apps/desktop/src/main/runtime.ts',
      bestChunkName: 'ElectronRuntime',
      bestChunkType: 'class',
      hasClassOrFunction: true,
      preview: 'electron desktop app packaging mac tools-dev',
    }), baseContext('Open Design Electron desktop app tools-dev electron app packaging mac consuelo design upstream open-design'));

    expect(scored.parts.isGeneratedOrNoisy).toBe(false);
    expect(scored.parts.tokenCoverage).toBeGreaterThan(0);
  });

  it('keeps post-call analysis above generic manifests for issue-style soft queries', () => {
    const query = 'DEV-1508 dialer post-call analysis Pi agent Groq transcript automatic disposition';
    const postCall = scoreCandidate(candidate({
      path: 'packages/agent/src/skills/post-call-analysis.md',
      bestChunkName: 'Post-Call Analysis',
      bestChunkType: 'block',
      embeddingSimilarity: 0.82,
      preview: 'post-call analysis transcript disposition call outcome groq agent',
    }), baseContext(query));
    const manifest = scoreCandidate(candidate({
      path: 'packages/chat-bot/slack-manifest.json',
      bestChunkName: 'display_information',
      bestChunkType: 'block',
      embeddingSimilarity: 0.95,
      preview: 'display information bot scopes commands shortcuts',
    }), baseContext(query));

    expect(postCall.score).toBeGreaterThan(manifest.score);
    expect(postCall.parts.tokenCoverage).toBeGreaterThan(manifest.parts.tokenCoverage);
  });

  it('keeps domain implementation files above generic facade plumbing for dialer queue queries', () => {
    const query = 'how does dialer queue call target resolution work';
    const domainFile = scoreCandidate(candidate({
      path: 'packages/dialer/src/dialer.ts',
      bestChunkName: 'Dialer',
      bestChunkType: 'class',
      embeddingSimilarity: 0.82,
      hasClassOrFunction: true,
      implementationNames: 'Dialer Queue Call Target Resolution',
      preview: 'dialer queue call target resolution work',
    }), baseContext(query));
    const facade = scoreCandidate(candidate({
      path: 'packages/workspace/scripts/lib/facade/executor.ts',
      bestChunkName: 'TaskSessionResolution',
      bestChunkType: 'function',
      embeddingSimilarity: 0.95,
      hasClassOrFunction: true,
      implementationNames: 'TaskSessionResolution',
      preview: 'resolve workspace task session command execution',
    }), baseContext(query));

    expect(domainFile.score).toBeGreaterThan(facade.score);
    expect(domainFile.parts.tokenCoverage).toBeGreaterThan(facade.parts.tokenCoverage);
  });

  it('does not let graph centrality overpower weak domain fit for product queries', () => {
    const query = 'how does dialer queue call target resolution work';
    const context = baseContext(query);
    context.edgeCounts.set('packages/workspace/scripts/lib/facade/executor.ts', 23);
    context.edgeCounts.set('packages/api/src/shared/dialer.ts', 8.6);

    const domainFile = scoreCandidate(candidate({
      path: 'packages/api/src/shared/dialer.ts',
      bestChunkName: 'buildDialer',
      bestChunkType: 'function',
      embeddingSimilarity: 0.9,
      hasClassOrFunction: true,
      implementationNames: 'buildDialer',
      preview: 'shared dialer builder configuration',
    }), context);
    const facade = scoreCandidate(candidate({
      path: 'packages/workspace/scripts/lib/facade/executor.ts',
      bestChunkName: 'TaskSessionResolution',
      bestChunkType: 'type',
      embeddingSimilarity: 0.95,
      hasClassOrFunction: true,
      implementationNames: 'TaskSessionResolution',
      preview: 'resolve workspace task session command execution',
    }), context);

    expect(domainFile.parts.lexicalScore).toBeGreaterThan(facade.parts.lexicalScore);
    expect(domainFile.score).toBeGreaterThan(facade.score);
  });
});