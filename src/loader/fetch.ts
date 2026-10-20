export interface FetchTextOptions {
  readonly headers: Readonly<Record<string, string>>;
  readonly timeout: number;
  readonly maxBytes: number;
  /** Called for every redirect target; return an error message to refuse it. */
  readonly checkRedirect: (target: URL) => string | undefined;
  /** Headers are only sent to this origin (the origin of the configured input), never elsewhere. */
  readonly credentialOrigin?: string | undefined;
}

/** HTTP cache validators of a fetched document, for conditional requests. */
export interface Validators {
  readonly etag?: string;
  readonly lastModified?: string;
}

export interface FetchedText {
  readonly text: string;
  readonly contentType: string;
  readonly url: URL;
  readonly validators: Validators;
}

const MAX_REDIRECTS = 5;

/**
 * Fetches a text document with a timeout, a size limit and policy-checked redirects. Custom
 * headers (which may carry credentials) are never forwarded to a different origin.
 */
export async function fetchText(url: URL, options: FetchTextOptions): Promise<FetchedText> {
  const result = await fetchTextIfModified(url, options, {});
  if (result === undefined) throw new Error('Unexpected 304 Not Modified response.');
  return result;
}

/**
 * Like {@link fetchText}, but sends `If-None-Match`/`If-Modified-Since` from `validators` and
 * resolves with `undefined` when the server answers `304 Not Modified`.
 */
export async function fetchTextIfModified(
  url: URL,
  options: FetchTextOptions,
  validators: Validators,
): Promise<FetchedText | undefined> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const headers: Record<string, string> = {
      accept: 'application/json, application/yaml, text/yaml, */*;q=0.5',
      ...(validators.etag === undefined ? {} : { 'if-none-match': validators.etag }),
      ...(validators.lastModified === undefined
        ? {}
        : { 'if-modified-since': validators.lastModified }),
    };
    // Configured headers may carry credentials: only the configured input's origin receives them.
    if (options.credentialOrigin !== undefined && options.credentialOrigin === current.origin) {
      Object.assign(headers, options.headers);
    }
    const response = await fetch(current, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeout),
    });
    if (response.status === 304) {
      await response.body?.cancel();
      return undefined;
    }
    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      await response.body?.cancel();
      const next = new URL(response.headers.get('location') ?? '', current);
      const refusal = options.checkRedirect(next);
      if (refusal !== undefined) throw new Error(`Redirect to ${next.href} refused: ${refusal}`);
      current = next;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > options.maxBytes) {
      await response.body?.cancel();
      throw new Error(`Document exceeds the ${options.maxBytes} byte limit (${declared} bytes).`);
    }
    const text = await readLimited(response, options.maxBytes);
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    return {
      text,
      contentType: response.headers.get('content-type') ?? '',
      url: current,
      validators: {
        ...(etag === null ? {} : { etag }),
        ...(lastModified === null ? {} : { lastModified }),
      },
    };
  }
  throw new Error(`Too many redirects (more than ${MAX_REDIRECTS}).`);
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  if (response.body === null) return '';
  const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Document exceeds the ${maxBytes} byte limit.`);
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
}
