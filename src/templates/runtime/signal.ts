export interface LinkedSignal {
  /** Aborts when the caller's signal aborts or the timeout elapses. */
  readonly signal: AbortSignal | undefined;
  /** Whether the timeout (not the caller) caused the abort. */
  timedOut(): boolean;
  /** Clears the timer and listeners. */
  dispose(): void;
}

/** Combines an optional caller signal with an optional timeout in milliseconds. */
export function linkSignal(
  signal: AbortSignal | undefined,
  timeout: number | undefined,
): LinkedSignal {
  if (timeout === undefined || timeout <= 0) {
    return { signal, timedOut: () => false, dispose: () => undefined };
  }
  const controller = new AbortController();
  let didTimeout = false;
  const onAbort = (): void => {
    controller.abort(signal?.reason);
  };
  if (signal?.aborted === true) controller.abort(signal.reason);
  else signal?.addEventListener('abort', onAbort, { once: true });
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    didTimeout = true;
    controller.abort(new Error(`Timed out after ${timeout} ms`));
  }, timeout);
  return {
    signal: controller.signal,
    timedOut: () => didTimeout,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

/** Returns a signal that aborts when any of the given signals aborts. */
export function anySignal(
  ...signals: readonly (AbortSignal | undefined)[]
): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (active.length <= 1) return active[0];
  const controller = new AbortController();
  const cleanups: (() => void)[] = [];
  const abort = (reason: unknown): void => {
    for (const cleanup of cleanups) cleanup();
    controller.abort(reason);
  };
  for (const signal of active) {
    if (signal.aborted) {
      abort(signal.reason);
      return controller.signal;
    }
    const listener = (): void => {
      abort(signal.reason);
    };
    signal.addEventListener('abort', listener, { once: true });
    cleanups.push(() => {
      signal.removeEventListener('abort', listener);
    });
  }
  return controller.signal;
}
