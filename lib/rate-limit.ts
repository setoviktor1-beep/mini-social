type RateLimitEntry = {
  count: number;
  resetTime: number;
};

type CheckResult = {
  success: boolean;
  remaining: number;
  resetIn: number;
};

const store = new Map<string, RateLimitEntry>();

let cleanupTimerStarted = false;

function startCleanupTimer() {
  if (cleanupTimerStarted) return;
  cleanupTimerStarted = true;

  setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (entry.resetTime <= now) {
        store.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}

export function rateLimit({ limit, windowMs }: { limit: number; windowMs: number }) {
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
