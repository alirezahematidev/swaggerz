/**
 * Responses the runtime does not read as JSON, with response validation on: responses to `HEAD`,
 * which never have a body.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateCase, OUTPUT_ROOT } from '../../support/generate.ts';
import { startMockServer, type MockServer } from '../../support/mock-server.ts';

const SPEC = `openapi: 3.1.0
info:
  title: Responses
  version: '1'
paths:
  /pets/{petId}:
    head:
      operationId: petExists
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: The pet exists; GET would return it.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Pet'
        '404':
          description: No such pet.
components:
  schemas:
    Pet:
      type: object
      required: [id]
      properties:
        id:
          type: integer
`;

type Operation = (params: object) => Promise<unknown>;
interface Api {
  readonly petExists: Operation;
  readonly client: { setConfig(config: Record<string, unknown>): void };
}

let server: MockServer;
let api: Api;

beforeAll(async () => {
  server = await startMockServer();
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const input = path.join(OUTPUT_ROOT, 'runtime-responses.yaml');
  await writeFile(input, SPEC);
  const { directory } = await generateCase('runtime-responses', {
    spec: { version: '3.1', input },
    features: { validation: { library: 'zod', response: true } },
  });
  api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as Api;
  api.client.setConfig({ baseUrl: server.url });
});

afterAll(async () => {
  await server.close();
});

describe('responses without a JSON body', () => {
  it('resolve HEAD requests with undefined, even when the response documents content', async () => {
    server.respond(() => ({ status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(api.petExists({ petId: 1 })).resolves.toBeUndefined();
    expect(server.requests.at(-1)?.method).toBe('HEAD');
    server.respond(() => ({ status: 404 }));
    await expect(api.petExists({ petId: 2 })).rejects.toMatchObject({ status: 404 });
  });
});
