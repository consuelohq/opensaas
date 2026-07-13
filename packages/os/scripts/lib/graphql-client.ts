type GraphQLProofResult = {
  status: 'connected' | 'missing_env' | 'query_failed' | 'not_configured';
  urlHost?: string;
  hasApiKey: boolean;
  safeMessage?: string;
};

type GraphQLResponse = {
  data?: unknown;
  errors?: Array<{ message?: string }>;
};

const DEFAULT_QUERY = 'query ConsueloOsConnectivityProbe { __typename }';

function getUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 240);
  return 'GraphQL request failed';
}

function classifyGraphQLErrors(response: GraphQLResponse): GraphQLProofResult['status'] {
  const message = response.errors?.map((error) => error.message ?? '').join(' ').toLowerCase() ?? '';
  if (
    message.includes('cannot query field') ||
    message.includes('unknown type') ||
    message.includes('not found') ||
    message.includes('schema')
  ) {
    return 'not_configured';
  }
  return 'query_failed';
}

export async function proveGraphQLConnectivity(): Promise<GraphQLProofResult> {
  const url = (process.env.CONSUELO_APP_GRAPHQL_URL ?? process.env.CONSUELO_GRAPHQL_URL);
  const apiKey = (process.env.CONSUELO_APP_GRAPHQL_API_KEY ?? process.env.CONSUELO_INTERNAL_GRAPHQL_API_KEY);
  const hasApiKey = Boolean(apiKey);

  if (!url || !apiKey) {
    return {
      status: 'missing_env',
      urlHost: url ? getUrlHost(url) : undefined,
      hasApiKey,
      safeMessage: 'CONSUELO_GRAPHQL_URL or CONSUELO_INTERNAL_GRAPHQL_API_KEY is missing.',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: DEFAULT_QUERY }),
      signal: AbortSignal.timeout(10_000),
    });

    const body = await response.json().catch(() => ({})) as GraphQLResponse;
    if (!response.ok) {
      return {
        status: 'query_failed',
        urlHost: getUrlHost(url),
        hasApiKey,
        safeMessage: `GraphQL HTTP ${response.status}`,
      };
    }

    if (body.errors?.length) {
      return {
        status: classifyGraphQLErrors(body),
        urlHost: getUrlHost(url),
        hasApiKey,
        safeMessage: body.errors[0]?.message?.slice(0, 240) ?? 'GraphQL returned errors.',
      };
    }

    return {
      status: 'connected',
      urlHost: getUrlHost(url),
      hasApiKey,
    };
  } catch (error: unknown) {
    return {
      status: 'query_failed',
      urlHost: getUrlHost(url),
      hasApiKey,
      safeMessage: safeErrorMessage(error),
    };
  }
}

