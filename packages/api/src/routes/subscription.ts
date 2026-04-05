import * as Sentry from "@sentry/node";
import { errorHandler } from "../middleware/error-handler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { RouteDefinition } from "./index.js";
import {
  getSubscriptionStatus,
  createCheckoutSession,
  createPortalSession,
  PRICE_IDS,
} from "../services/subscription.js";

let _logger: {
  info: (message: string, meta?: Record<string, unknown>) => void;
} | null = null;
const getLogger = async () => {
  if (!_logger) {
    const { createLogger } = await import("@consuelo/logger");
    _logger = createLogger("api:subscription");
  }
  return _logger;
};

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_URL_ORIGINS ?? "consuelohq.com,localhost"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const validateAbsoluteUrl = (
  url: string,
): { valid: true; origin: string } | { valid: false; error: string } => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "URL must use http or https protocol" };
    }
    const hostname = parsed.hostname.toLowerCase();
    const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
      if (allowed.startsWith(".")) {
        return hostname.endsWith(allowed) || hostname === allowed.slice(1);
      }
      return hostname === allowed || hostname.endsWith("." + allowed);
    });
    if (!isAllowed) {
      return { valid: false, error: "URL origin not allowed" };
    }
    return { valid: true, origin: parsed.origin };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
};

interface CheckoutBody {
  priceIds?: string[];
  interval?: "month" | "year";
  addOns?: string[];
  successUrl: string;
  cancelUrl: string;
}

interface PortalBody {
  returnUrl: string;
}

export const subscriptionRoutes = (): RouteDefinition[] => [
  {
    method: "GET",
    path: "/v1/subscription/status",
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (!auth) return;

      const status = await getSubscriptionStatus(auth.workspaceId);
      res.status(200).json(status);
    }),
  },

  {
    method: "POST",
    path: "/v1/subscription/checkout",
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (!auth) return;

      const body = req.body as CheckoutBody | undefined;
      if (!body?.successUrl || !body?.cancelUrl) {
        Sentry.captureMessage("Checkout missing URLs", "warning");
        res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message: "successUrl and cancelUrl required",
          },
        });
        return;
      }

      const successUrlValidation = validateAbsoluteUrl(body.successUrl);
      if (!successUrlValidation.valid) {
        Sentry.captureMessage(
          `Invalid successUrl: ${successUrlValidation.error}`,
          "warning",
        );
        res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message: `Invalid successUrl: ${successUrlValidation.error}`,
          },
        });
        return;
      }

      const cancelUrlValidation = validateAbsoluteUrl(body.cancelUrl);
      if (!cancelUrlValidation.valid) {
        Sentry.captureMessage(
          `Invalid cancelUrl: ${cancelUrlValidation.error}`,
          "warning",
        );
        res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message: `Invalid cancelUrl: ${cancelUrlValidation.error}`,
          },
        });
        return;
      }

      const interval = body.interval ?? "month";
      const priceIds: string[] = body.priceIds ?? [];

      if (priceIds.length === 0) {
        const basePrice =
          interval === "year" ? PRICE_IDS.baseAnnual : PRICE_IDS.baseMonthly;
        if (basePrice) priceIds.push(basePrice);

        if (body.addOns?.includes("dialer-coach")) {
          const p =
            interval === "year"
              ? PRICE_IDS.dialerCoachAnnual
              : PRICE_IDS.dialerCoachMonthly;
          if (p) priceIds.push(p);
        }
        if (body.addOns?.includes("ai-assistant")) {
          const p =
            interval === "year"
              ? PRICE_IDS.aiAssistantAnnual
              : PRICE_IDS.aiAssistantMonthly;
          if (p) priceIds.push(p);
        }
      }

      if (priceIds.length === 0) {
        res.status(400).json({
          error: {
            code: "NO_PRICES",
            message: "No price IDs configured — set STRIPE_PRICE_* env vars",
          },
        });
        return;
      }

      const result = await createCheckoutSession(
        auth.workspaceId,
        priceIds,
        body.successUrl,
        body.cancelUrl,
      );

      try {
        (await getLogger()).info("checkout.initiated", {
          userId: auth.userId,
          workspaceId: auth.workspaceId,
        });
      } catch (logErr: unknown) {
        Sentry.captureException(logErr);
      }

      res.status(200).json(result);
    }),
  },

  {
    method: "POST",
    path: "/v1/subscription/portal",
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (!auth) return;

      const body = req.body as PortalBody | undefined;
      if (!body?.returnUrl) {
        Sentry.captureMessage("Portal missing returnUrl", "warning");
        res.status(400).json({
          error: { code: "BAD_REQUEST", message: "returnUrl required" },
        });
        return;
      }

      const returnUrlValidation = validateAbsoluteUrl(body.returnUrl);
      if (!returnUrlValidation.valid) {
        Sentry.captureMessage(
          `Invalid returnUrl: ${returnUrlValidation.error}`,
          "warning",
        );
        res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message: `Invalid returnUrl: ${returnUrlValidation.error}`,
          },
        });
        return;
      }

      const result = await createPortalSession(
        auth.workspaceId,
        body.returnUrl,
      );

      try {
        (await getLogger()).info("portal.opened", {
          userId: auth.userId,
          workspaceId: auth.workspaceId,
        });
      } catch (logErr: unknown) {
        Sentry.captureException(logErr);
      }

      res.status(200).json(result);
    }),
  },
];
