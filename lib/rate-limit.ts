import Redis from 'ioredis';

type RateLimitEntry = {
  count: number;
  resetTime: number;
};

export type CheckResult = {
  success: boolean;
  remaining: number;
  resetIn: number; // in seconds
};

export interface RateLimiter {
  check(key: string): Promise<CheckResult> | CheckResult;
}
const store = new Map<string, RateLimitEntry>();

let cleanupTimerStarted = false;

function startCleanupTimer() {
  if (cleanupTimerStarted) return;
  cleanupTimerStarted = true;

  if (typeof setInterval !== 'undefined') {
    const timer = setInterval(() => {
      const now = Date.now();
      store.forEach((entry, key) => {
        if (entry.resetTime <= now) {
          store.delete(key);
        }
      });
    }, 5 * 60 * 1000);
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }
}

function memoryRateLimit({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  startCleanupTimer();

  return {
    check(key: string): CheckResult {
      const now = Date.now();
      const safeKey = key || "anonymous";
      const current = store.get(safeKey);

      if (!current || now > current.resetTime) {
        const resetTime = now + windowMs;
        store.set(safeKey, { count: 1, resetTime });
        return {
          success: true,
          remaining: Math.max(0, limit - 1),
          resetIn: Math.ceil((resetTime - now) / 1000),
        };
      }

      if (current.count >= limit) {
        return {
          success: false,
          remaining: 0,
          resetIn: Math.ceil((current.resetTime - now) / 1000),
        };
      }

      current.count += 1;
      store.set(safeKey, current);

      return {
        success: true,
        remaining: Math.max(0, limit - current.count),
        resetIn: Math.ceil((current.resetTime - now) / 1000),
      };
    },
  };
}

let sharedRedis: Redis | undefined;

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  sharedRedis ||= new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  return sharedRedis;
}

// Redis-backed fixed-window limiter shared across all app instances. Falls
// back to the in-process limiter (best-effort only, per-instance) if Redis
// is unavailable or a command fails, so a Redis blip never hard-fails a request.
function redisRateLimit({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const fallback = memoryRateLimit({ limit, windowMs });

  return {
    async check(key: string): Promise<CheckResult> {
      const redis = getRedis();
      if (!redis) return fallback.check(key);

      const safeKey = `ratelimit:${key || 'anonymous'}`;
      try {
        if (redis.status === 'wait') await redis.connect();
        const count = await redis.incr(safeKey);
        if (count === 1) {
          await redis.pexpire(safeKey, windowMs);
        }
        const ttl = await redis.pttl(safeKey);
        const resetIn = Math.ceil((ttl > 0 ? ttl : windowMs) / 1000);

        if (count > limit) {
          return { success: false, remaining: 0, resetIn };
        }
        return { success: true, remaining: Math.max(0, limit - count), resetIn };
      } catch (error) {
        console.error('Redis rate limit check failed, falling back to in-process limiter', error);
        return fallback.check(key);
      }
    },
  };
}

export function rateLimit({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  return redisRateLimit({ limit, windowMs });
}
