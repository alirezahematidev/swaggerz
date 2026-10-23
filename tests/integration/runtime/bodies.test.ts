import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateCase, OUTPUT_ROOT } from '../../support/generate.ts';
import { startMockServer, type MockServer } from '../../support/mock-server.ts';

// Generated modules are loaded dynamically; their types are checked by the compile tests.
type Module = Record<string, (...args: unknown[]) => Promise<unknown>> & {
  client: { setConfig(config: Record<string, unknown>): void };
};

const SPEC = `openapi: 3.1.0
info: { title: Bodies, version: '1' }
paths:
  /files/{id}:
    get:
      operationId: downloadFile
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
        - { name: X-Label, in: header, schema: { type: string } }
      responses:
        '200':
          description: The file
          content: { application/octet-stream: { schema: { type: string, format: binary } } }
        '404':
          description: Missing
          content: { application/json: { schema: { $ref: '#/components/schemas/Problem' } } }
  /notes:
    get:
      operationId: readNote
      responses:
        '200': { description: ok, content: { text/plain: { schema: { type: string } } } }
        '400':
          description: Invalid
          content: { application/json: { schema: { $ref: '#/components/schemas/Problem' } } }
  /reports:
    get:
      operationId: getReport
      responses:
        '200':
          description: JSON or PDF
          content:
            application/json: { schema: { type: object } }
            application/pdf: { schema: { type: string, format: binary } }
  /charges:
    post:
      operationId: createCharge
      requestBody:
        required: true
        content:
          application/x-www-form-urlencoded:
            schema:
              type: object
              properties:
                amount: { type: integer }
                metadata: { type: object, additionalProperties: { type: string } }
            encoding:
              metadata: { style: deepObject, explode: true }
      responses:
        '200': { description: ok, content: { application/json: { schema: { type: object } } } }
  /documents:
    post:
      operationId: uploadDocument
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                meta: { type: object, properties: { title: { type: string } } }
                rows: { type: string }
                file: { type: string, format: binary }
            encoding:
              rows: { contentType: text/csv }
      responses:
        '204': { description: ok }
  /anything:
    post:
      operationId: postAnything
      requestBody:
        required: true
        content:
          '*/*': { schema: { type: object, properties: { a: { type: integer } } } }
      responses:
        '204': { description: ok }
components:
  schemas:
    Problem:
      type: object
      required: [title]
      properties: { title: { type: string } }
`;

let server: MockServer;
let input: string;

beforeAll(async () => {
  server = await startMockServer();
  input = path.join(OUTPUT_ROOT, 'specs', 'bodies.yaml');
  await mkdir(path.dirname(input), { recursive: true });
  await writeFile(input, SPEC);
});
afterAll(async () => {
  await server.close();
});

const rejection = async (promise: Promise<unknown>): Promise<Error & Record<string, unknown>> => {
  try {
    await promise;
  } catch (error) {
    return error as Error & Record<string, unknown>;
  }
  throw new Error('Expected the promise to reject');
};

describe.each(['fetch', 'axios'] as const)('%s adapter', (adapter) => {
  let api: Module;

  beforeAll(async () => {
    const { directory } = await generateCase(`runtime-bodies-${adapter}`, {
      spec: { version: '3.1', input },
      client: { adapter },
    });
    api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as Module;
    api.client.setConfig({ baseUrl: server.url });
  });

  it('reads error bodies by their content type, not by the success media type', async () => {
    server.respond(() => ({ status: 404, body: { title: 'No such file' } }));
    const missing = await rejection(api.downloadFile!({ id: 'f1' }));
    expect(missing).toMatchObject({ name: 'ApiError', status: 404 });
    expect(missing.body).toEqual({ title: 'No such file' });

    server.respond(() => ({ status: 400, body: { title: 'Bad note' } }));
    expect((await rejection(api.readNote!())).body).toEqual({ title: 'Bad note' });

    // Successful responses still follow the hint.
    server.respond(() => ({ headers: { 'content-type': 'text/plain' }, body: 'note' }));
    await expect(api.readNote!()).resolves.toBe('note');
  });

  it('returns binary responses of operations without a body hint as Blobs', async () => {
    const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0xff, 0xfe, 0x00, 0x80]);
    server.respond(() => ({ headers: { 'content-type': 'application/pdf' }, body: bytes }));
    const report = await api.getReport!();
    expect(report).toBeInstanceOf(Blob);
    expect((report as Blob).type).toBe('application/pdf');
    expect([...new Uint8Array(await (report as Blob).arrayBuffer())]).toEqual([...bytes]);

    server.respond(() => ({ body: { pages: 2 } }));
    await expect(api.getReport!()).resolves.toEqual({ pages: 2 });
  });

  it('rejects malformed JSON in successful responses', async () => {
    server.respond(() => ({
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    }));
    await expect(rejection(api.getReport!())).resolves.toMatchObject({
      name: 'RequestError',
      kind: 'parse',
    });
  });

  it('sends multipart JSON and typed parts with their Content-Type, not as files', async () => {
    server.respond(() => ({ status: 204 }));
    await api.uploadDocument!({
      body: {
        meta: { title: 'Q3' },
        rows: 'a,b',
        file: new File(['%PDF'], 'q3.pdf', { type: 'application/pdf' }),
      },
    });
    const request = server.requests.at(-1)!;
    expect(request.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    const text = request.text();
    expect(text).toContain(
      'Content-Disposition: form-data; name="meta"\r\nContent-Type: application/json\r\n\r\n{"title":"Q3"}',
    );
    expect(text).toContain(
      'Content-Disposition: form-data; name="rows"\r\nContent-Type: text/csv\r\n\r\na,b',
    );
    expect(text).toContain(
      'Content-Disposition: form-data; name="file"; filename="q3.pdf"\r\nContent-Type: application/pdf',
    );
    const form = await request.formData();
    expect(form.get('meta')).toBe('{"title":"Q3"}');
    expect((form.get('file') as File).name).toBe('q3.pdf');
  });

  it('serializes deepObject properties of urlencoded bodies', async () => {
    server.respond(() => ({ body: {} }));
    await api.createCharge!({ body: { amount: 5, metadata: { order_id: '6735' } } });
    expect(decodeURIComponent(server.requests.at(-1)?.text() ?? '')).toBe(
      'amount=5&metadata[order_id]=6735',
    );
  });

  it('sends JSON for a wildcard request media type', async () => {
    server.respond(() => ({ status: 204 }));
    await api.postAnything!({ body: { a: 1 } });
    expect(server.requests.at(-1)?.headers['content-type']).toBe('application/json');
    expect(server.requests.at(-1)?.json()).toEqual({ a: 1 });
  });

  it('reports header values that are not byte strings as serialization errors', async () => {
    server.respond(() => ({ body: '' }));
    const error = await rejection(api.downloadFile!({ id: 'f1', 'X-Label': 'naïve ✓' }));
    expect(error).toMatchObject({ name: 'RequestError', kind: 'serialization' });
    expect(server.requests).toHaveLength(0);
  });
});
