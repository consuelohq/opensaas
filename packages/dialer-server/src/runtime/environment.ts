import { Dialer, type TwilioCredentials } from '@consuelo/dialer';

import type { DialerApplicationLayers } from '../application';
import { createEffectDialerApplication } from '../application';
import type { DialerServerDependencies } from '../contracts';
import { runApplicationEffect } from '../effect-runner';
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
    const runtimeModulePath = environment.DIALER_SERVER_RUNTIME_MODULE?.trim();
    const imported = (
      runtimeModulePath
        ? await import(runtimeModulePath)
        : await import('./railway.js')
    ) as Partial<RuntimeModule>;
    if (typeof imported.createDialerApplicationLayers !== 'function') {
      throw new Error(
        'Runtime module must export createDialerApplicationLayers',
      );
    }
    const layers = await imported.createDialerApplicationLayers(environment);
    const leadConnectorLayer = imported.createLeadConnectorApplicationLayer
      ? await imported.createLeadConnectorApplicationLayer(environment)
      : null;
    const leadConnector = leadConnectorLayer
      ? createEffectLeadConnectorApplication(leadConnectorLayer)
      : undefined;
    const identities = parseIdentities(
      environment.DIALER_SERVER_AUTH_IDENTITIES_JSON?.trim() || '[]',
    );
    const voiceCredentials: TwilioCredentials = {
      accountSid: required(environment, 'TWILIO_ACCOUNT_SID'),
      authToken: required(environment, 'TWILIO_AUTH_TOKEN'),
      apiKey: environment.TWILIO_API_KEY?.trim(),
      apiSecret: environment.TWILIO_API_SECRET?.trim(),
      twimlAppSid: environment.TWILIO_TWIML_APP_SID?.trim(),
    };
    const voiceDialer = new Dialer({ credentials: voiceCredentials });
    const staticAuthenticator = createBearerAuthenticator(identities);
    const embedSessions = createEmbedSessionService({
      secret: required(environment, 'DIALER_SERVER_EMBED_SESSION_SECRET'),
      ttlSeconds: Number(
        environment.DIALER_SERVER_EMBED_SESSION_TTL_SECONDS || '900',
      ),
      validateIdentity: async (identity) => {
        if (!leadConnector) return false;
        const result = await runApplicationEffect(
          leadConnector.validateEmbedIdentity(identity),
        );
        return result.ok && result.value;
      },
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
        leadConnector,
        verifyTwilioSignature: createTwilioSignatureVerifier(
          required(environment, 'TWILIO_AUTH_TOKEN'),
        ),
        issueVoiceToken: (identity) => voiceDialer.getToken(identity.userId),
      },
    };
  } catch (error: unknown) {
    throw new Error('Dialer server runtime configuration failed', {
      cause: error,
    });
  }
}
