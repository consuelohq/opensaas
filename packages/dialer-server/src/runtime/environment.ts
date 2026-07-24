import type { DialerApplicationLayers } from '../application';
import { createEffectDialerApplication } from '../application';
import type { DialerServerDependencies } from '../contracts';
import {
  createEffectLeadConnectorApplication,
  type LeadConnectorApplicationLayer,
} from '../lead-connector-application';
import { createBearerAuthenticator, type BearerIdentity } from './auth';
import { createEmbedSessionService } from './embed-session';
import { createTwilioSignatureVerifier } from './twilio-signature';

export type DialerServerEnvironment = Record<string, string | undefined>;

type RuntimeModule = {
  createDialerApplicationLayers: (
    environment: DialerServerEnvironment,
  ) => Promise<DialerApplicationLayers> | DialerApplicationLayers;
  createLeadConnectorApplicationLayer?: (
    environment: DialerServerEnvironment,
  ) => Promise<LeadConnectorApplicationLayer> | LeadConnectorApplicationLayer;
};

export type DialerServerRuntimeConfig = {
  hostname: string;
  port: number;
  dependencies: DialerServerDependencies;
};

const required = (
  environment: DialerServerEnvironment,
  name: string,
): string => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const parseIdentities = (value: string): BearerIdentity[] => {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('DIALER_SERVER_AUTH_IDENTITIES_JSON must be an array');
  }
  return parsed.map((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error('Invalid dialer identity');
    }
    const record = candidate as Record<string, unknown>;
    for (const key of ['token', 'workspaceId', 'userId']) {
      if (typeof record[key] !== 'string' || !record[key]) {
        throw new Error(`Invalid dialer identity ${key}`);
      }
    }
    return record as BearerIdentity;
  });
};

export async function loadDialerServerRuntime(
  environment: DialerServerEnvironment = process.env,
): Promise<DialerServerRuntimeConfig> {
  try {
    const runtimeModulePath = required(
      environment,
      'DIALER_SERVER_RUNTIME_MODULE',
    );
    const imported = (await import(
      runtimeModulePath
    )) as Partial<RuntimeModule>;
    if (typeof imported.createDialerApplicationLayers !== 'function') {
      throw new Error(
        'Runtime module must export createDialerApplicationLayers',
      );
    }
    const layers = await imported.createDialerApplicationLayers(environment);
    const leadConnectorLayer = imported.createLeadConnectorApplicationLayer
      ? await imported.createLeadConnectorApplicationLayer(environment)
      : null;
    const identities = parseIdentities(
      required(environment, 'DIALER_SERVER_AUTH_IDENTITIES_JSON'),
    );
    const staticAuthenticator = createBearerAuthenticator(identities);
    const embedSessions = createEmbedSessionService({
      secret: required(environment, 'DIALER_SERVER_EMBED_SESSION_SECRET'),
      ttlSeconds: Number(
        environment.DIALER_SERVER_EMBED_SESSION_TTL_SECONDS || '900',
      ),
    });
    const authenticate = async (request: Request) => {
      try {
        return (
          (await embedSessions.authenticate(request)) ??
          (await staticAuthenticator(request))
        );
      } catch (error: unknown) {
        throw new Error('Dialer server authentication failed', {
          cause: error,
        });
      }
    };
    return {
      hostname: environment.HOST?.trim() || '0.0.0.0',
      port: Number(environment.PORT || '3000'),
      dependencies: {
        application: createEffectDialerApplication(layers),
        authenticate,
        issueEmbedSession: embedSessions.issue,
        leadConnector: leadConnectorLayer
          ? createEffectLeadConnectorApplication(leadConnectorLayer)
          : undefined,
        verifyTwilioSignature: createTwilioSignatureVerifier(
          required(environment, 'TWILIO_AUTH_TOKEN'),
        ),
      },
    };
  } catch (error: unknown) {
    throw new Error('Dialer server runtime configuration failed', {
      cause: error,
    });
  }
}
