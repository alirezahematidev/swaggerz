/**
 * The playground's state in the URL fragment, compressed with deflate. The fragment is never sent
 * to a server, so a shared link carries the specification without it leaving the browser.
 */
export interface PlaygroundOptions {
  readonly language: 'typescript' | 'javascript';
  readonly adapter: 'fetch' | 'axios';
  readonly hooks: 'none' | 'react' | 'vue' | 'svelte' | 'solid' | 'swr';
  readonly validation: 'none' | 'zod' | 'valibot' | 'arktype';
  readonly dates: 'string' | 'Date';
  readonly readWrite: 'split' | 'merged';
  readonly lint: boolean;
}

export interface PlaygroundState {
  readonly fileName: string;
  readonly spec: string;
  readonly options: PlaygroundOptions;
}

export const DEFAULT_OPTIONS: PlaygroundOptions = {
  language: 'typescript',
  adapter: 'fetch',
  hooks: 'none',
  validation: 'none',
  dates: 'string',
  readWrite: 'split',
  lint: false,
};

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const response = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

export async function encodeState(state: PlaygroundState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(state));
  if (typeof CompressionStream === 'undefined') return `j1.${toBase64Url(json)}`;
  return `z1.${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`;
}

function isOptions(value: unknown): value is PlaygroundOptions {
  return typeof value === 'object' && value !== null && 'language' in value && 'hooks' in value;
}

export async function decodeState(fragment: string): Promise<PlaygroundState | undefined> {
  const [kind, payload] = fragment.replace(/^#/, '').split('.', 2);
  if (payload === undefined) return undefined;
  try {
    const bytes =
      kind === 'z1'
        ? await pipe(fromBase64Url(payload), new DecompressionStream('deflate-raw'))
        : kind === 'j1'
          ? fromBase64Url(payload)
          : undefined;
    if (bytes === undefined) return undefined;
    const value = JSON.parse(new TextDecoder().decode(bytes)) as Partial<PlaygroundState>;
    if (typeof value.spec !== 'string' || typeof value.fileName !== 'string') return undefined;
    return {
      spec: value.spec,
      fileName: value.fileName,
      options: isOptions(value.options)
        ? { ...DEFAULT_OPTIONS, ...value.options }
        : DEFAULT_OPTIONS,
    };
  } catch {
    return undefined;
  }
}
