import { Injectable } from '@nestjs/common';

import { SearchHelpCenterInputZodSchema } from 'src/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool.schema';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import {
  type Tool,
  type ToolExecutionContext,
} from 'src/engine/core-modules/tool/types/tool.type';

type DocumentationSearchResult = {
  title: string;
  path: string;
  url: string;
};

const DOCUMENTATION_BASE_URL = 'https://docs.consuelohq.com';
const MAX_SEARCH_RESULTS = 10;
const STOP_WORDS = new Set([
  'a',
  'about',
  'and',
  'for',
  'how',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);
const DOCUMENTATION_SEARCH_PATHS = [
  '/',
  '/developers/agent/crm-tools',
  '/developers/agent/integrations',
  '/developers/agent/overview',
  '/developers/agent/tool-system',
  '/developers/api/auth',
  '/developers/api/contacts',
  '/developers/api/graphql',
  '/developers/api/overview',
  '/developers/api/voice',
  '/developers/introduction',
  '/os/concepts/approvals',
  '/os/concepts/context-and-memory',
  '/os/concepts/data-model-and-graphql',
  '/os/concepts/files-and-artifacts',
  '/os/concepts/integrations-and-capabilities',
  '/os/concepts/local-and-cloud',
  '/os/concepts/observability',
  '/os/concepts/portal',
  '/os/concepts/scripts',
  '/os/concepts/skills',
  '/os/glossary',
  '/os/how-it-works',
  '/os/overview',
  '/os/tools/browser-tools',
  '/os/tools/overview',
  '/tools/media/getting-started',
  '/tools/office',
  '/tools/overview',
  '/tools/sites/overview',
  '/user-guide/getting-started/capabilities/glossary',
  '/user-guide/getting-started/capabilities/implementation-services',
  '/user-guide/getting-started/capabilities/keyboard-shortcuts',
  '/user-guide/getting-started/capabilities/what-is-consuelo',
  '/user-guide/getting-started/how-tos/configure-your-workspace',
  '/user-guide/getting-started/how-tos/create-workspace',
  '/user-guide/getting-started/how-tos/navigate-around-consuelo',
  '/user-guide/introduction',
  '/user-guide/user-stories-use-cases',
] as const;

const documentationRoutes: DocumentationSearchResult[] =
  DOCUMENTATION_SEARCH_PATHS.map((path) => ({
    path,
    title:
      path
        .replace(/^\//, '')
        .split('/')
        .filter(Boolean)
        .map((part) => part.replace(/-/g, ' '))
        .join(' › ') || 'Consuelo Docs',
    url: DOCUMENTATION_BASE_URL + path,
  }));

function normalizeSearchText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 1 && !STOP_WORDS.has(part));
}

function scoreRoute(route: DocumentationSearchResult, terms: string[]): number {
  const searchable = (route.path + ' ' + route.title).toLowerCase();

  return terms.reduce((score, term) => {
    if (route.path.toLowerCase().includes(term)) {
      return score + 3;
    }

    if (searchable.includes(term)) {
      return score + 1;
    }

    return score;
  }, 0);
}

@Injectable()
export class SearchHelpCenterTool implements Tool {
  description =
    'Search Consuelo documentation to find information about features, setup, usage, and troubleshooting.';
  inputSchema = SearchHelpCenterInputZodSchema;

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput<{ results: DocumentationSearchResult[] }>> {
    const query = typeof parameters.query === 'string' ? parameters.query : '';
    const terms = normalizeSearchText(query);

    if (terms.length === 0) {
      return {
        success: true,
        message: 'Enter a more specific documentation search query.',
        result: { results: [] },
      };
    }

    const results = documentationRoutes
      .map((route) => ({ route, score: scoreRoute(route, terms) }))
      .filter(({ score }) => score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.route.path.localeCompare(right.route.path),
      )
      .slice(0, MAX_SEARCH_RESULTS)
      .map(({ route }) => route);

    if (results.length === 0) {
      return {
        success: true,
        message: 'No Consuelo documentation pages found for "' + query + '"',
        result: { results: [] },
      };
    }

    return {
      success: true,
      message:
        'Found ' +
        results.length +
        ' relevant Consuelo documentation page' +
        (results.length === 1 ? '' : 's') +
        ' for "' +
        query +
        '"',
      result: { results },
    };
  }
}
