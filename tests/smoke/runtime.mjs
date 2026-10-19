/**
 * Runs a generated JavaScript client against a local server on the current Node.js version.
 * Plain JavaScript without dependencies so it runs on Node.js versions older than the generator
 * supports (CI runs it on Node.js 18 and 20).
 *
 * Usage: node dist/cli/bin.js generate --config tests/smoke/swaggerz.config.mjs
 *        node tests/smoke/runtime.mjs
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  ApiError,
  RequestError,
  client,
  downloadPhoto,
  findPetsByStatus,
  getPetById,
  uploadFile,
} from '../.output/smoke/api/index.js';

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('latin1');
    const url = new URL(req.url ?? '/', 'http://localhost');
    const json = (status, data) => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(data));
    };
    if (url.pathname === '/pet/findByStatus') {
      json(200, [{ id: 1, name: 'Rex', status: url.searchParams.get('status'), photoUrls: [] }]);
    } else if (url.pathname === '/pet/1/uploadImage') {
      json(200, {
        code: 200,
        message: url.searchParams.get('additionalMetadata'),
        type: `${req.headers['content-type'] ?? ''}\n${body}`,
      });
    } else if (url.pathname === '/pet/1/photo') {
      res.setHeader('content-type', 'image/png');
      res.end(Buffer.from([137, 80, 78, 71]));
    } else if (url.pathname === '/pet/2') {
      setTimeout(() => json(200, {}), 2000);
    } else {
      json(404, { message: 'missing' });
    }
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
const address = server.address();
assert.ok(address !== null && typeof address === 'object');
client.setConfig({ baseUrl: `http://127.0.0.1:${address.port}` });

try {
  const pets = await findPetsByStatus({ status: 'sold' });
  assert.equal(pets[0]?.status, 'sold', 'JSON response and query parameter');

  const uploaded = await uploadFile({
    petId: 1,
    additionalMetadata: 'meta',
    body: { file: new Blob(['hello'], { type: 'text/plain' }), tags: ['x', 'y'] },
  });
  assert.equal(uploaded.message, 'meta');
  assert.match(uploaded.type ?? '', /^multipart\/form-data; boundary=/, 'multipart content type');
  assert.match(uploaded.type ?? '', /name="file"; filename="[^"]*"\r\nContent-Type: text\/plain/);
  assert.match(uploaded.type ?? '', /name="tags"\r\n\r\nx\r\n/, 'array form fields');

  const photo = await downloadPhoto({ petId: 1 });
  assert.ok(photo instanceof Blob, 'binary responses are Blobs');
  assert.equal(photo.size, 4);

  await assert.rejects(
    getPetById({ petId: 404 }),
    (error) => error instanceof ApiError && error.status === 404,
  );
  await assert.rejects(
    getPetById({ petId: 2 }, { timeout: 50 }),
    (error) => error instanceof RequestError && error.kind === 'timeout',
  );
  const controller = new AbortController();
  const pending = getPetById({ petId: 2 }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => error instanceof Error && error.name === 'AbortError');
} finally {
  server.closeAllConnections();
  server.close();
}
console.log(`Generated client works on Node.js ${process.versions.node}.`);
