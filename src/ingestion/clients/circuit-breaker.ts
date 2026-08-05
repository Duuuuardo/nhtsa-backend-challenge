export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly failureThreshold: number,
    private readonly resetTimeoutMs: number,
  ) {
    if (failureThreshold < 1) {
      throw new Error('failureThreshold must be at least 1');
    }

    if (resetTimeoutMs < 1) {
      throw new Error('resetTimeoutMs must be at least 1');
    }
  }

  get currentState(): CircuitBreakerState {
    return this.state;
  }

  get retryAfterMs(): number {
    if (this.state !== 'open' || this.openedAt === null) {
      return 0;
    }

    return Math.max(0, this.resetTimeoutMs - (Date.now() - this.openedAt));
  }

  canAttempt(): boolean {
    if (this.state !== 'open') {
      return true;
    }

    const openedAt = this.openedAt ?? 0;
    if (Date.now() - openedAt >= this.resetTimeoutMs) {
      this.state = 'half-open';
      return true;
    }

    return false;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'closed';
    this.openedAt = null;
  }

  recordFailure(): void {
    if (this.state === 'half-open') {
      this.state = 'open';
      this.openedAt = Date.now();
      this.consecutiveFailures = 0;
      return;
    }

    this.consecutiveFailures += 1;

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }
}
