import { describe, expect, it } from 'vitest';
import { createClient } from '../../../src/templates/runtime/client.ts';
import type { OperationRequest, TransportRequest } from '../../../src/templates/runtime/types.ts';

function recordingClient(auth: Record<string, string>) {
  const requests: TransportRequest[] = [];
  const client = createClient({
    baseUrl: 'http://api.test',
    auth,
    securitySchemes: {
      queryKey: { type: 'apiKey', in: 'query', name: 'key' },
      headerKey: { type: 'apiKey', in: 'header', name: 'x-key' },
    },
    transport: (request) => {
      requests.push(request);
      return Promise.resolve({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        data: null,
        raw: undefined,
      });
    },
  });
  return { client, requests };
}

const search = (mediaType: string): OperationRequest => ({
  operationId: 'search',
  method: 'GET',
  path: '/search',
  querystring: { value: { text: 'q' }, mediaType },
  security: [['queryKey'], ['headerKey']],
});

describe('querystring parameters and query API keys', () => {
  it('appends query API keys to a form query string', async () => {
    const { client, requests } = recordingClient({ queryKey: 'k1', headerKey: 'k2' });
    await client.request(search('application/x-www-form-urlencoded'));
    expect(requests[0]?.url).toBe('http://api.test/search?text=q&key=k1');
  });

  it('uses another alternative instead of breaking a JSON query string', async () => {
    const { client, requests } = recordingClient({ queryKey: 'k1', headerKey: 'k2' });
    await client.request(search('application/json'));
    expect(decodeURIComponent(requests[0]?.url ?? '')).toBe('http://api.test/search?{"text":"q"}');
    expect(requests[0]?.headers.get('x-key')).toBe('k2');
  });

  it('sends no query credentials when no other alternative is configured', async () => {
    const { client, requests } = recordingClient({ queryKey: 'k1' });
    await client.request(search('text/plain'));
    expect(requests[0]?.url).toBe('http://api.test/search?%7B%22text%22%3A%22q%22%7D');
    expect(requests[0]?.url).not.toContain('key=');
  });
});
