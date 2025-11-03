/**
 * Simple rate limiter for RTM API calls
 * RTM allows ~1 req/sec per user
 */
export class RateLimiter {
  private lastCall: number = 0;
  private minInterval: number;

  constructor(minIntervalMs: number = 500) {
    this.minInterval = minIntervalMs;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCall;

    if (elapsed < this.minInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minInterval - elapsed)
      );
    }

    this.lastCall = Date.now();
  }
}
