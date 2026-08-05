import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('remains closed until the failure threshold is reached', () => {
    const breaker = new CircuitBreaker(3, 1000);

    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.currentState).toBe('closed');
    expect(breaker.canAttempt()).toBe(true);
  });

  it('opens after the configured number of consecutive failures', () => {
    const breaker = new CircuitBreaker(2, 1000);

    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.currentState).toBe('open');
    expect(breaker.canAttempt()).toBe(false);
  });

  it('transitions to half-open after the reset timeout elapses', () => {
    const breaker = new CircuitBreaker(2, 1000);

    breaker.recordFailure();
    breaker.recordFailure();

    jest.setSystemTime(1000);

    expect(breaker.canAttempt()).toBe(true);
    expect(breaker.currentState).toBe('half-open');
  });

  it('closes and resets failures when a half-open attempt succeeds', () => {
    const breaker = new CircuitBreaker(2, 1000);

    breaker.recordFailure();
    breaker.recordFailure();

    jest.setSystemTime(1000);
    expect(breaker.canAttempt()).toBe(true);
    expect(breaker.currentState).toBe('half-open');

    breaker.recordSuccess();

    expect(breaker.currentState).toBe('closed');
    expect(breaker.canAttempt()).toBe(true);
  });

  it('reopens and restarts the timer when a half-open attempt fails', () => {
    const breaker = new CircuitBreaker(2, 1000);

    breaker.recordFailure();
    breaker.recordFailure();

    jest.setSystemTime(1000);
    expect(breaker.canAttempt()).toBe(true);
    expect(breaker.currentState).toBe('half-open');

    breaker.recordFailure();

    expect(breaker.currentState).toBe('open');
    expect(breaker.canAttempt()).toBe(false);

    jest.setSystemTime(1999);
    expect(breaker.canAttempt()).toBe(false);

    jest.setSystemTime(2000);
    expect(breaker.canAttempt()).toBe(true);
    expect(breaker.currentState).toBe('half-open');
  });

  it('resets consecutive failure count after a success', () => {
    const breaker = new CircuitBreaker(3, 1000);

    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.currentState).toBe('closed');
    expect(breaker.canAttempt()).toBe(true);
  });
});
