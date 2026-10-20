import type { ServerEvent } from '../../api-types.ts';
import { authorization } from '../api.ts';

/**
 * `live`: receiving updates; `connecting`: (re)connecting after a dropped connection;
 * `offline`: the server rejected the session (it was restarted) or live reload is unavailable.
 */
export type LiveState = 'connecting' | 'live' | 'offline';

const RETRY_MS = [1000, 2000, 4000, 8000];
/** Failed attempts after which the server is reported as gone (retries continue). */
const OFFLINE_AFTER = 3;

function parse(block: string): ServerEvent | undefined {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (data === '') return undefined;
  try {
    const value = JSON.parse(data) as unknown;
    return typeof value === 'object' && value !== null && 'type' in value
      ? (value as ServerEvent)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Subscribes to the server's event stream. `EventSource` cannot send the session token in a
 * header, so the stream is read with `fetch`. Reconnects with backoff; returns an unsubscribe.
 */
export function subscribe(
  onEvent: (event: ServerEvent) => void,
  onState: (state: LiveState) => void,
): () => void {
  const controller = new AbortController();
  // A function, so the check is not narrowed away across `await`s.
  const stopped = (): boolean => controller.signal.aborted;
  let attempt = 0;

  const connect = async (): Promise<void> => {
    while (!stopped()) {
      if (attempt < OFFLINE_AFTER) onState('connecting');
      try {
        const response = await fetch('/api/events', {
          headers: { authorization: authorization() },
          signal: controller.signal,
        });
        // 401: the session ended (the dashboard was restarted with a new token). Not retried.
        if (response.status === 401 || response.status === 404) {
          onState('offline');
          return;
        }
        if (!response.ok || response.body === null) throw new Error(response.statusText);
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let end = buffer.indexOf('\n\n');
          while (end !== -1) {
            const event = parse(buffer.slice(0, end));
            buffer = buffer.slice(end + 2);
            if (event !== undefined) {
              if (event.type === 'hello') {
                attempt = 0;
                onState('live');
              }
              onEvent(event);
            }
            end = buffer.indexOf('\n\n');
          }
        }
      } catch {
        if (stopped()) return;
      }
      if (stopped()) return;
      onState(attempt + 1 >= OFFLINE_AFTER ? 'offline' : 'connecting');
      const delay = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)] ?? 8000;
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  };
  void connect();
  return () => {
    controller.abort();
  };
}
