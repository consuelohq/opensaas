import * as Sentry from '@sentry/node';
import type { ApiRequest, ApiResponse } from '../types.js';
import {
  getBillingMode,
  hasAddOn,
  type AddOnKey,
} from '../services/subscription.js';

// feature gate: requires add-on subscription for hosted workspaces
// byok workspaces bypass all gates — they pay for their own infra
export function requireAddOn(addOn: AddOnKey) {
  return async (
    req: ApiRequest,
    res: ApiResponse,
    next: () => void,
  ): Promise<void> => {
    const workspaceId = req.auth?.workspaceId;
    if (!workspaceId) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    try {
      const mode = await getBillingMode(workspaceId);

      // byok: no gates
      if (mode === 'byok') {
        next();
        return;
      }

      // hosted: check add-on subscription
      const has = await hasAddOn(workspaceId, addOn);
      if (!has) {
        res.status(402).json({
          error: {
            code: 'SUBSCRIPTION_REQUIRED',
            message: `${addOn} add-on required for hosted workspaces`,
          },
        });
        return;
      }

      next();
    } catch (err: unknown) {
      Sentry.captureException(err);
      res.status(500).json({
        error: {
          code: 'GATE_CHECK_FAILED',
          message: 'Failed to verify subscription status',
        },
      });
    }
  };
}
