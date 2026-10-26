// @ts-check
/**
 * Runtime-agnostic checks of the generated mock handlers (petstore-3.0.yaml with
 * `features.mocks`), driven through the generated client with `mockFetch()`: nothing is
 * intercepted, so the same file runs in Node.js, Deno, Bun, browsers and edge runtimes.
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
 * Runs the mock checks with the generated client module `api` and its mocks module `mocks`.
 *
 * @param {any} api
 * @param {any} mocks
 * @returns {Promise<Check[]>}
 */
export async function runMocksSuite(api, mocks) {
  /** @type {Check[]} */
  const results = [];
  /** @param {string} name @param {() => Promise<void>} check */
  const test = async (name, check) => {
    try {
      await check();
      results.push({ name: `mocks: ${name}`, ok: true });
    } catch (error) {
      results.push({
        name: `mocks: ${name}`,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  /** A client answered by `handlers`. @param {unknown[]} handlers */
  const answeredBy = (handlers) =>
    api.createClient({
      ...api.client.getConfig(),
      transport: api.createFetchTransport({ fetch: mocks.mockFetch(handlers) }),
    });
  const client = answeredBy(mocks.mockHandlers());

  await test('default handlers respond with the fixtures', async () => {
    const pet = await api.getPetById({ petId: 1 }, { client });
    assert(JSON.stringify(pet) === JSON.stringify(mocks.makePet()), JSON.stringify(pet));
  });

  await test('documented statuses reject with their fixture', async () => {
    const error = await rejection(
      api.getPetById({ petId: 1 }, { client: answeredBy([mocks.mockGetPetById({ status: 404 })]) }),
    );
    assert(api.isGetPetByIdApiError(error) && error.status === 404, String(error));
    assert(JSON.stringify(error.body) === JSON.stringify(mocks.makeError()), 'error body');
  });

  await test('response functions read params and JSON bodies', async () => {
    const echo = answeredBy([
      mocks.mockGetPetById({
        /** @param {any} request */
        body: ({ params }) => mocks.makePet({ id: Number(params.petId) }),
      }),
      mocks.mockAddPet({
        /** @param {any} request */
        body: async ({ body }) => ({ ...(await body()), id: 9 }),
      }),
    ]);
    const pet = await api.getPetById({ petId: 42 }, { client: echo });
    assert(pet.id === 42, `id was ${pet.id}`);
    const added = await api.addPet({ body: { name: 'Rex', photoUrls: [] } }, { client: echo });
    assert(added.name === 'Rex' && added.id === 9, JSON.stringify(added));
  });

  await test('response functions read multipart bodies', async () => {
    const upload = answeredBy([
      mocks.mockUploadFile({
        /** @param {any} request */
        body: async ({ body }) => {
          const form = await body();
          const file = form.get('file');
          return { code: 200, message: `${file.size}:${form.getAll('tags').join(',')}` };
        },
      }),
    ]);
    const result = await api.uploadFile(
      { petId: 1, body: { file: new Blob(['hello']), tags: ['x', 'y'] } },
      { client: upload },
    );
    assert(result.message === '5:x,y', `message was ${result.message}`);
  });

  await test('network errors reject with a RequestError', async () => {
    const error = await rejection(
      api.getPetById(
        { petId: 1 },
        { client: answeredBy([mocks.mockGetPetById({ networkError: true })]) },
      ),
    );
    assert(api.isRequestError(error) && error.kind === 'network', String(error));
  });

  return results;
}
