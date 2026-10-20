// @ts-check
/**
 * Runtime-agnostic checks of a generated client (petstore-3.0.yaml). Plain JavaScript that only
 * uses standard web APIs, so the same file runs in Node.js, Deno, Bun, browsers and edge runtimes.
 * The server it talks to is started by `scripts/runtimes.ts`.
 *
 * @typedef {{ name: string, ok: boolean, error?: string }} Check
 */

/** @param {unknown} condition @param {string} message */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Resolves with the rejection of `promise`, or fails when it resolves.
 * @param {Promise<unknown>} promise
 * @returns {Promise<any>}
 */
async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the call to reject');
}

/**
 * Runs every check against the generated client module `api` with the test server at `baseUrl`.
 * `run` is a unique id so that server-side counters (retries) never mix between runs.
 *
 * @param {any} api
 * @param {string} baseUrl
 * @param {string} run
 * @returns {Promise<Check[]>}
 */
export async function runSuite(api, baseUrl, run) {
  /** @type {Check[]} */
  const results = [];
  /** @param {string} name @param {() => Promise<void>} check */
  const test = async (name, check) => {
    try {
      await check();
      results.push({ name, ok: true });
    } catch (error) {
      results.push({
        name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const client = api.createClient({
    ...api.client.getConfig(),
    baseUrl,
    headers: { 'x-run': run },
  });
  const options = { client };

  await test('JSON response and exploded query parameters', async () => {
    const pets = await api.findPetsByTags({ tags: ['a', 'b'] }, options);
    assert(pets[0]?.name === 'a,b', `query was ${pets[0]?.name}`);
  });

  await test('path parameters are percent-encoded', async () => {
    const user = await api.getUserByName({ username: 'a b/c' }, options);
    assert(user.username === '/user/a%20b%2Fc', `path was ${user.username}`);
  });

  await test('JSON request bodies', async () => {
    const pet = await api.addPet({ body: { name: 'Rex', photoUrls: ['x'] } }, options);
    assert(pet.name === 'Rex' && pet.id === 7, JSON.stringify(pet));
  });

  await test('multipart uploads with Blobs and arrays', async () => {
    const uploaded = await api.uploadFile(
      {
        petId: 1,
        additionalMetadata: 'meta',
        body: { file: new Blob(['hello'], { type: 'text/plain' }), tags: ['x', 'y'] },
      },
      options,
    );
    assert(uploaded.message === 'meta', `metadata was ${uploaded.message}`);
    const echo = uploaded.type ?? '';
    assert(
      echo.startsWith('multipart/form-data; boundary='),
      `content type was ${echo.split('\n')[0]}`,
    );
    assert(/name="file"; filename="[^"]*"\r\nContent-Type: text\/plain/.test(echo), 'file part');
    assert(/name="tags"\r\n\r\nx\r\n/.test(echo), 'array parts');
  });

  await test('binary responses are Blobs', async () => {
    const photo = await api.downloadPhoto({ petId: 1 }, options);
    assert(photo instanceof Blob && photo.size === 4, `got ${String(photo)}`);
  });

  await test('API keys are sent as declared', async () => {
    const inventory = await api.getInventory({
      client: api.createClient({ ...client.getConfig(), auth: { api_key: 'secret' } }),
    });
    assert(inventory.key === 1, JSON.stringify(inventory));
  });

  await test('error statuses reject with ApiError, narrowed by the operation guard', async () => {
    const error = await rejection(api.getPetById({ petId: 404 }, options));
    assert(error instanceof api.ApiError, `got ${String(error)}`);
    assert(api.isGetPetByIdApiError(error), 'guard accepts its own errors');
    assert(!api.isGetInventoryApiError(error), 'guard rejects other operations');
    assert(error.status === 404 && error.body.message === 'missing', JSON.stringify(error.body));
  });

  await test('timeouts reject with RequestError', async () => {
    const error = await rejection(api.getPetById({ petId: 2 }, { client, timeout: 50 }));
    assert(error instanceof api.RequestError && error.kind === 'timeout', String(error));
  });

  await test('aborting rethrows the abort error', async () => {
    const controller = new AbortController();
    const pending = api.getPetById({ petId: 2 }, { client, signal: controller.signal });
    controller.abort();
    const error = await rejection(pending);
    assert(!(error instanceof api.RequestError), 'not wrapped');
    assert(error instanceof Error && error.name === 'AbortError', `got ${String(error)}`);
  });

  await test('middleware runs in order around the request', async () => {
    const calls = /** @type {string[]} */ ([]);
    const traced = api.createClient(client.getConfig());
    traced.use({
      /** @param {any} context */
      onRequest(context) {
        calls.push('request');
        context.request.headers.set('x-trace', 'on');
      },
      /** @param {any} context */
      onResponse(context) {
        calls.push(`response ${context.response.status}`);
      },
    });
    const pets = await api.findPetsByTags({ tags: ['t'] }, { client: traced });
    assert(pets[0]?.tag === 'on', 'header added by middleware');
    assert(calls.join(',') === 'request,response 200', calls.join(','));
  });

  await test('retry() resends a failed idempotent request', async () => {
    const retrying = api.createClient(client.getConfig());
    retrying.use(api.retry({ delay: 5 }));
    const order = await api.getOrderById({ orderId: 503 }, { client: retrying });
    assert(order.id === 503 && order.status === 'placed', JSON.stringify(order));
  });

  await test('refreshAuth() refreshes once and replays', async () => {
    let refreshes = 0;
    const authed = api.createClient({ ...client.getConfig(), auth: { petstore_auth: 'expired' } });
    authed.use(
      api.refreshAuth({
        scheme: 'petstore_auth',
        refresh: async () => {
          refreshes++;
          return 'renewed';
        },
      }),
    );
    const pets = await Promise.all([
      api.findPetsByStatus({ status: 'sold' }, { client: authed }),
      api.findPetsByStatus({ status: 'sold' }, { client: authed }),
    ]);
    assert(
      pets.every((list) => list[0]?.status === 'sold'),
      JSON.stringify(pets),
    );
    assert(refreshes === 1, `refreshed ${refreshes} times`);
  });

  return results;
}
