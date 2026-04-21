import * as Sentry from "@sentry/node";
import IORedis, { type RedisOptions } from "ioredis";

export type ApiRedisClientRole = "request" | "session";

const REDIS_LIFECYCLE_LOG_COOLDOWN_MS = 30000;

const redisClients: Partial<Record<ApiRedisClientRole, IORedis>> = {};
const lastLifecycleLogAt = new Map<string, number>();

let loggerInstance: {
  error: (message: string, attributes?: Record<string, unknown>) => void;
  info: (message: string, attributes?: Record<string, unknown>) => void;
  warn: (message: string, attributes?: Record<string, unknown>) => void;
} | null = null;

const getLogger = async () => {
  if (!loggerInstance) {
    try {
      const { createLogger } = await import("@consuelo/logger");
      loggerInstance = createLogger("api:redis-client");
    } catch {
      loggerInstance = {
        error: () => {},
        info: () => {},
        warn: () => {},
      };
    }
  }

  return loggerInstance;
};

const shouldLogLifecycleEvent = (key: string): boolean => {
  const now = Date.now();
  const lastLoggedAt = lastLifecycleLogAt.get(key) ?? 0;

  if (now - lastLoggedAt < REDIS_LIFECYCLE_LOG_COOLDOWN_MS) {
    return false;
  }

  lastLifecycleLogAt.set(key, now);

  return true;
};

const logLifecycleEvent = async (
  level: "info" | "warn" | "error",
  role: ApiRedisClientRole,
  event: string,
  attributes: Record<string, unknown> = {},
): Promise<void> => {
  const dedupeKey = `${role}:${event}:${String(attributes["message"] ?? "")}:${String(attributes["delayMs"] ?? "")}`;

  if (!shouldLogLifecycleEvent(dedupeKey)) {
    return;
  }

  const payload = { role, event, ...attributes };
  const logger = await getLogger();

  switch (level) {
    case "error":
      logger.error("redis.lifecycle", payload);
      break;
    case "warn":
      logger.warn("redis.lifecycle", payload);
      break;
    default:
      logger.info("redis.lifecycle", payload);
      break;
  }
};

const getRedisUrl = (): string => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL not configured");
  }

  return redisUrl;
};

const buildRedisOptions = (role: ApiRedisClientRole): RedisOptions => {
  return {
    connectTimeout: 10000,
    enableReadyCheck: true,
    keepAlive: 10000,
    maxRetriesPerRequest: role === "session" ? 2 : 1,
    retryStrategy: (times) => Math.min(times * 250, 5000),
  };
};

const clearRedisClient = (role: ApiRedisClientRole, client: IORedis): void => {
  if (redisClients[role] === client) {
    delete redisClients[role];
  }
};

const attachLifecycleHandlers = (
  client: IORedis,
  role: ApiRedisClientRole,
): void => {
  client.on("connect", () => {
    void logLifecycleEvent("info", role, "connect");
  });

  client.on("ready", () => {
    void logLifecycleEvent("info", role, "ready");
  });

  client.on("reconnecting", (delay: number) => {
    void logLifecycleEvent("warn", role, "reconnecting", { delayMs: delay });
  });

  client.on("close", () => {
    void logLifecycleEvent("warn", role, "close", { status: client.status });
  });

  client.on("end", () => {
    clearRedisClient(role, client);
    void logLifecycleEvent("warn", role, "end");
  });

  client.on("error", (err) => {
    const redisError = err as NodeJS.ErrnoException;

    void logLifecycleEvent("error", role, "error", {
      code: redisError.code ?? null,
      message: redisError.message,
      status: client.status,
    });

    Sentry.captureException(err, {
      tags: {
        component: "ApiRedisClient",
        role,
      },
      extra: {
        event: "error",
        status: client.status,
      },
    });
  });
};

export const getApiRedisClient = async (
  role: ApiRedisClientRole = "request",
): Promise<IORedis> => {
  try {
    const existingClient = redisClients[role];

    if (existingClient && existingClient.status !== "end") {
      return existingClient;
    }

    const client = new IORedis(getRedisUrl(), buildRedisOptions(role));

    attachLifecycleHandlers(client, role);
    redisClients[role] = client;

    return client;
  } catch (err: unknown) {
    delete redisClients[role];
    Sentry.captureException(err, {
      tags: {
        component: "ApiRedisClient",
        role,
      },
      extra: {
        event: "create",
      },
    });
    throw err;
  }
};
