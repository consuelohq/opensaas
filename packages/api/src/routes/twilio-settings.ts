import { errorHandler } from "../middleware/error-handler.js";
import type { RouteDefinition } from "./index.js";
import * as Sentry from "@sentry/node";
import {
  getWorkspaceTwilioConfig,
  getDecryptedCredentials,
  saveByokConfig,
  deleteWorkspaceTwilioConfig,
  isHostedInstance,
  maskCredential,
  ensureOrCreateTwimlApp,
  syncTwimlAppUrl,
} from "../services/twilio-config.js";
import { invalidateDialerCache } from "../shared/dialer.js";

let _settingsLogger: {
  info: (message: string, attributes?: Record<string, unknown>) => void;
  warn: (message: string, attributes?: Record<string, unknown>) => void;
  error: (message: string, attributes?: Record<string, unknown>) => void;
} | null = null;
const getLogger = async () => {
  if (!_settingsLogger) {
    const { createLogger } = await import("@consuelo/logger");
    _settingsLogger = createLogger("api:twilio-settings");
  }
  return _settingsLogger;
};

interface ByokBody {
  accountSid: string;
  authToken: string;
  apiKey?: string;
  apiSecret?: string;
}

const isTwilioAuthError = (err: unknown): boolean => {
  if (err instanceof Error) {
    if (
      /\b20003\b/.test(err.message) ||
      /authenticate/i.test(err.message) ||
      /\b401\b/.test(err.message)
    ) {
      return true;
    }
  }
  if (err && typeof err === "object") {
    const e = err as { status?: number; code?: number; statusCode?: number };
    const status = e.status ?? e.statusCode;
    if (status === 401 || e.code === 20003) {
      return true;
    }
  }
  return false;
};

export const twilioSettingsRoutes = (): RouteDefinition[] => [
  {
    method: "GET",
    path: "/v1/settings/twilio/health",
    handler: errorHandler(async (req, res) => {
      const workspaceId = req.auth?.workspaceId;
      if (!workspaceId) {
        res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Auth required" },
        });
        return;
      }

      try {
        const config = await getWorkspaceTwilioConfig(workspaceId);
        if (!config || !config.twimlAppSid) {
          res.status(200).json({
            healthy: false,
            issues: ["No TwiML App configured for this workspace"],
          });
          return;
        }

        const creds = getDecryptedCredentials(config);
        const issues: string[] = [];

        try {
          const syncResult = await syncTwimlAppUrl(
            creds.accountSid,
            creds.authToken,
            config.twimlAppSid,
          );
          if (syncResult.updated) {
            issues.push(
              "TwiML App voice URL was outdated and has been updated",
            );
          }
        } catch (fetchErr: unknown) {
          const fetchMessage =
            fetchErr instanceof Error ? fetchErr.message : "unknown error";
          if (
            fetchMessage.includes("20404") ||
            fetchMessage.includes("not found")
          ) {
            try {
              const newSid = await ensureOrCreateTwimlApp(
                creds.accountSid,
                creds.authToken,
                workspaceId,
              );
              invalidateDialerCache(workspaceId);
              issues.push(
                `TwiML App was missing and has been re-created (${newSid})`,
              );
            } catch (createErr: unknown) {
              const createMessage =
                createErr instanceof Error
                  ? createErr.message
                  : "unknown error";
              res.status(200).json({
                healthy: false,
                twimlAppSid: config.twimlAppSid,
                issues: [
                  `TwiML App deleted and re-creation failed: ${createMessage}`,
                ],
              });
              return;
            }
          } else {
            issues.push(`Failed to verify TwiML App: ${fetchMessage}`);
          }
        }

        const updatedConfig = await getWorkspaceTwilioConfig(workspaceId);
        res.status(200).json({
          healthy:
            issues.length === 0 || issues.every((i) => i.includes("has been")),
          twimlAppSid: updatedConfig?.twimlAppSid ?? config.twimlAppSid,
          issues,
        });
      } catch (err: unknown) {
        Sentry.captureException(err);
        res.status(500).json({
          error: { code: "HEALTH_CHECK_ERROR", message: "Health check failed" },
        });
      }
    }),
  },

  {
    method: "GET",
    path: "/v1/settings/twilio",
    handler: errorHandler(async (req, res) => {
      const workspaceId = req.auth?.workspaceId;
      if (!workspaceId) {
        res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Auth required" },
        });
        return;
      }

      try {
        const config = await getWorkspaceTwilioConfig(workspaceId);
        const hosted = isHostedInstance();

        if (!config) {
          res.status(200).json({
            configured: false,
            mode: hosted ? "hosted" : null,
            hostedAvailable: hosted,
          });
          return;
        }

        const creds = getDecryptedCredentials(config);
        res.status(200).json({
          configured: true,
          mode: config.mode,
          hostedAvailable: hosted,
          accountSid: maskCredential(creds.accountSid),
          twimlAppSid: config.twimlAppSid ?? null,
          ...(config.mode === "byok" && creds.apiKey
            ? { apiKey: maskCredential(creds.apiKey) }
            : {}),
        });
      } catch (err: unknown) {
        Sentry.captureException(err);
        res.status(500).json({
          error: {
            code: "CONFIG_ERROR",
            message: "Unable to retrieve Twilio configuration",
          },
        });
      }
    }),
  },

  {
    method: "POST",
    path: "/v1/settings/twilio/test",
    handler: errorHandler(async (req, res) => {
      const workspaceId = req.auth?.workspaceId;
      if (!workspaceId) {
        res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Auth required" },
        });
        return;
      }

      const body = req.body as ByokBody | undefined;
      if (
        typeof body?.accountSid !== "string" ||
        !body.accountSid ||
        typeof body?.authToken !== "string" ||
        !body.authToken
      ) {
        res.status(400).json({
          error: {
            code: "INVALID_REQUEST",
            message: "Missing accountSid or authToken",
          },
        });
        return;
      }

      try {
        const twilio = await import("twilio");
        const createClient =
          twilio.default ??
          (twilio as unknown as { default: typeof twilio.default }).default;
        const testClient = createClient(body.accountSid, body.authToken);
        await testClient.api.accounts(body.accountSid).fetch();
        res.status(200).json({ valid: true });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const isAuthError = isTwilioAuthError(err);
        res.status(isAuthError ? 400 : 500).json({
          valid: false,
          error: {
            code: isAuthError ? "INVALID_CREDENTIALS" : "CONNECTION_ERROR",
            message: isAuthError
              ? "Invalid Twilio credentials"
              : "Connection test failed",
          },
        });
      }
    }),
  },

  {
    method: "PUT",
    path: "/v1/settings/twilio",
    handler: errorHandler(async (req, res) => {
      const workspaceId = req.auth?.workspaceId;
      if (!workspaceId) {
        res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Auth required" },
        });
        return;
      }

      const body = req.body as ByokBody | undefined;
      if (
        typeof body?.accountSid !== "string" ||
        !body.accountSid ||
        typeof body?.authToken !== "string" ||
        !body.authToken
      ) {
        res.status(400).json({
          error: {
            code: "INVALID_REQUEST",
            message: "Missing accountSid or authToken",
          },
        });
        return;
      }

      try {
        const twilio = await import("twilio");
        const createClient =
          twilio.default ??
          (twilio as unknown as { default: typeof twilio.default }).default;
        const testClient = createClient(body.accountSid, body.authToken);
        await testClient.api.accounts(body.accountSid).fetch();

        await saveByokConfig(workspaceId, {
          accountSid: body.accountSid,
          authToken: body.authToken,
          apiKey: body.apiKey,
          apiSecret: body.apiSecret,
        });

        let twimlAppSid: string | undefined;
        let twimlWarning: string | undefined;
        try {
          twimlAppSid = await ensureOrCreateTwimlApp(
            body.accountSid,
            body.authToken,
            workspaceId,
          );
        } catch (twimlErr: unknown) {
          const twimlMessage =
            twimlErr instanceof Error ? twimlErr.message : "unknown error";
          twimlWarning = `TwiML App auto-creation failed: ${twimlMessage}`;
          (await getLogger()).warn("TwiML App auto-creation failed for BYOK", {
            workspaceId,
            error: twimlMessage,
          });
        }

        invalidateDialerCache(workspaceId);

        (await getLogger()).info("twilio BYOK config saved", {
          workspaceId,
          twimlAppSid,
        });
        res.status(200).json({
          mode: "byok",
          accountSid: maskCredential(body.accountSid),
          twimlAppSid: twimlAppSid ?? null,
          ...(twimlWarning ? { warning: twimlWarning } : {}),
        });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const isValidationError = isTwilioAuthError(err);
        res.status(isValidationError ? 400 : 500).json({
          error: {
            code: isValidationError ? "INVALID_CREDENTIALS" : "CONFIG_ERROR",
            message: isValidationError
              ? "Invalid Twilio credentials"
              : "Failed to save Twilio configuration",
          },
        });
      }
    }),
  },

  {
    method: "DELETE",
    path: "/v1/settings/twilio",
    handler: errorHandler(async (req, res) => {
      const workspaceId = req.auth?.workspaceId;
      if (!workspaceId) {
        res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Auth required" },
        });
        return;
      }

      try {
        await deleteWorkspaceTwilioConfig(workspaceId);
        invalidateDialerCache(workspaceId);

        (await getLogger()).info("twilio config deleted", { workspaceId });
        res.status(200).json({ deleted: true });
      } catch (err: unknown) {
        Sentry.captureException(err);
        res.status(500).json({
          error: {
            code: "CONFIG_ERROR",
            message: "Failed to delete Twilio configuration",
          },
        });
      }
    }),
  },
];
