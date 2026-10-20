/**
 * Consumer programs compiled against generated clients. `@ts-expect-error` lines assert that
 * invalid calls are rejected; everything else must type-check under the strictest settings.
 * `__API__` is replaced with the import path of the generated client.
 */
export const PETSTORE_CONSUMER = `
import {
  addPet, client, createClient, deletePet, downloadPhoto, findPetsByStatus, findPetsByTags, getInventory,
  getPetById, isApiError, isGetPetByIdApiError, loginUser, logoutUser, uploadFile, ApiError,
  type Error as ErrorModel, type GetPetByIdError, type GetPetByIdErrorBody, type NewPet, type Pet,
  type RequestOptions, type ValidationError,
} from '__API__';

export async function usage(signal: AbortSignal): Promise<unknown[]> {
  const pet: Pet = await getPetById({ petId: 1 }, { signal, timeout: 1000 });
  const id: number = pet.id;
  const newPet: NewPet = { name: 'x', photoUrls: [], status: 'available' };
  const created: Pet = await addPet({ body: newPet });
  const list: Pet[] = await findPetsByStatus();
  await findPetsByStatus({ status: 'sold' });
  // @ts-expect-error unknown enum value
  await findPetsByStatus({ status: 'gone' });
  // @ts-expect-error petId must be a number
  await getPetById({ petId: '1' });
  // @ts-expect-error missing required parameter
  await getPetById({});
  // @ts-expect-error the tags parameter is required
  await findPetsByTags();
  const deleted: void = await deletePet({ petId: 1, api_key: 'k' });
  const photo: Blob = await downloadPhoto({ petId: 1 });
  const inventory: Record<string, number> = await getInventory();
  const token: string = await loginUser({ username: 'u', password: 'p' });
  await logoutUser();
  await uploadFile({ petId: 1, body: { file: new Blob(['x']), tags: ['a'] } });
  const errors: ValidationError = { errors: { name: ['required'] } };
  client.setConfig({ baseUrl: 'http://localhost', auth: { api_key: 'key', petstore_auth: async () => 'token' } });
  const other = createClient({ ...client.getConfig(), baseUrl: 'http://other' });
  const options: RequestOptions = { client: other, headers: { 'x-trace': '1', removed: undefined } };
  await getPetById({ petId: 1 }, options);
  try {
    await getPetById({ petId: 1 });
  } catch (error) {
    if (isApiError(error)) {
      const status: number = error.status;
      void status;
    }
    // The operation's guard narrows the body together with the status.
    if (isGetPetByIdApiError(error)) {
      if (error.status === 404) {
        const message: string | undefined = error.body.message;
        void message;
      } else if (error.status === 400) {
        const empty: undefined = error.body;
        void empty;
      } else {
        // @ts-expect-error undocumented statuses have unknown bodies
        const body: ErrorModel = error.body;
        void body;
      }
      // @ts-expect-error 200 resolves; it is never an error status
      if (error.status === 200) void error;
    }
    const typed = error as GetPetByIdError;
    if (typed instanceof ApiError && typed.status === 404) {
      const message: string | undefined = typed.body.message;
      void message;
    }
    const legacy = (typed instanceof ApiError ? typed.body : undefined) as GetPetByIdErrorBody;
    void legacy;
  }
  return [id, created, list, deleted, photo, inventory, token, errors];
}
`;

export const FEATURES_CONSUMER = `
import {
  createShape, downloadDocument, getShape, getTree, listShapes, postEvent, uploadDocument,
  type Cat, type LegacyName, type Pet, type Shape, type TreeNode, type ViewEvent, type ListShapesError,
} from '__API__';

export async function usage(): Promise<unknown[]> {
  const maybeShape: Shape | undefined = await getShape({ shapeId: 's' });
  // A declared 304 resolves without a body.
  if (maybeShape === undefined) return [];
  const shape: Shape = maybeShape;
  let measure: number;
  if (shape.kind === 'circle') measure = shape.radius;
  else measure = shape.width;
  const page = await listShapes({ 'X-Request-ID': 'id', filter: { color: 'red' }, ids: [1, 2], cursor: null });
  const next: string | null | undefined = page.nextCursor;
  // @ts-expect-error the X-Request-ID header is required
  await listShapes({});
  const tree: TreeNode = await getTree();
  const child: TreeNode | null | undefined = tree.children?.[0] ?? tree.parent;
  const created: Shape = await createShape({ body: { kind: 'circle', radius: 1 } });
  // @ts-expect-error readOnly properties are not part of request bodies
  await createShape({ body: { kind: 'circle', id: 'c1', radius: 1 } });
  const readOnlyId: string = created.id;
  const cat: Cat = { petType: 'Cat', name: 'Tom', huntingSkill: 'lazy' };
  // @ts-expect-error the discriminator value must match the subtype
  const wrong: Cat = { petType: 'Dog', name: 'Rex' };
  const legacy: LegacyName = cat;
  const pet: Pet = legacy;
  await uploadDocument({ body: new Blob(['x']) });
  const document: Blob = await downloadDocument({ id: 'a', queryId: 'b' });
  const view: ViewEvent = { type: 'view', page: 'p', coordinates: [1, 2] };
  await postEvent({ body: view });
  const error = undefined as unknown as ListShapesError;
  return [measure, next, child, created, readOnlyId, wrong, pet, document, error];
}
`;

export const SWAGGER2_CONSUMER = `
import { addPet, findPetsByStatus, getOrderById, updatePetWithForm, uploadFile, type Cat, type Order, type Pet } from '__API__';

export async function usage(): Promise<unknown[]> {
  const pets: Pet[] = await findPetsByStatus({ status: ['available', 'sold'] });
  // @ts-expect-error status is required
  await findPetsByStatus();
  const pet: Pet = await addPet({ body: { name: 'x', photoUrls: [] } });
  await updatePetWithForm({ petId: 1, body: { name: 'n' } });
  await uploadFile({ petId: 1, body: { file: new Blob(['x']) } });
  const order: Order = await getOrderById({ orderId: 3 });
  const note: string | null | undefined = order.note;
  const cat: Cat = { petType: 'Cat', name: 'c', photoUrls: [], indoor: true };
  return [pets, pet, order, note, cat];
}
`;

export const ADVANCED_CONSUMER = `
import {
  client, createAccount, getAccount, listStatements, uploadAvatar,
  type Account, type AccountInput, type AccountClosedWebhookHandler,
  type CreateAccountAccountEventCallbackHandler, type CreateAccountBodies,
} from '__API__';

export async function usage(): Promise<unknown[]> {
  const input: AccountInput = { name: 'n', password: 'secret', birthday: new Date('2000-01-31') };
  // @ts-expect-error readOnly properties are not part of request bodies
  const withId: AccountInput = { name: 'n', password: 'p', id: 'x' };
  const created: Account = await createAccount({ body: input });
  const createdAt: Date = created.createdAt;
  // @ts-expect-error writeOnly properties are not part of responses
  const leaked: string = created.password;
  const born: Date | undefined = created.owner?.born;
  const reminder: Date | undefined = created.reminders?.['renewal'];
  await createAccount({ contentType: 'application/x-www-form-urlencoded', body: { name: 'n', password: 'p' } });
  await createAccount({ contentType: 'application/xml', body: '<account/>' });
  const xml: CreateAccountBodies['application/xml'] = new Blob(['<account/>']);
  // @ts-expect-error XML bodies are passed already encoded
  await createAccount({ contentType: 'application/xml', body: input });
  // @ts-expect-error only declared media types are accepted
  await createAccount({ contentType: 'text/plain', body: input });
  // A declared 304 resolves without a body.
  const account: Account | undefined = await getAccount({ accountId: 'a', 'If-None-Match': '"v1"' });
  const statements = await listStatements({ accountId: 'a', since: new Date('2026-01-01'), until: new Date() });
  const issued: Date | undefined = statements[0]?.issuedOn;
  // @ts-expect-error date parameters take Date values
  await listStatements({ accountId: 'a', since: '2026-01-01' });
  await uploadAvatar({ body: new Blob([]) });
  client.setConfig({ operationServers: false });
  const onClosed: AccountClosedWebhookHandler = async ({ body, headers }) => {
    const closedAt: Date = body.createdAt;
    const signature: string = headers['x-signature'];
    return { received: closedAt.getTime() > 0 && signature !== '' };
  };
  const onEvent: CreateAccountAccountEventCallbackHandler = ({ body }) => {
    if (body.type === 'closed') {
      const day: Date = body.closedOn;
      void day;
    }
  };
  return [withId, createdAt, leaked, born, reminder, xml, account, issued, onClosed, onEvent];
}
`;

export const FEATURES32_CONSUMER = `
import {
  copyDocument, exportAudit, getDocument, getPet, isSearchPetsApiError, listPets, searchDocuments,
  searchPets, streamEvents,
  type Document, type Owner, type Pet, type PetAdoptedWebhookRequest, type PetQuery, type Problem,
} from '__API__';

// Webhook requests include an OpenAPI 3.2 querystring parameter, parsed.
export const adopted: PetAdoptedWebhookRequest = {
  body: { kind: 'dog', name: 'Rex' },
  querystring: { attempt: 2 },
};

export async function usage(): Promise<unknown[]> {
  // QUERY: a body on a safe request.
  const pets: Pet[] = await searchPets({ body: { name: 'Tom', kinds: ['cat'] } });
  // @ts-expect-error the query document is required
  await searchPets({});
  for (const pet of pets) {
    // With defaultMapping, OtherPet stays possible for any kind (its kind is any string).
    const kind: string | undefined = pet.kind;
    if ('indoor' in pet) {
      const indoor: boolean | undefined = pet.indoor;
      void indoor;
    }
    void kind;
  }
  // The whole query string as one typed value.
  await listPets({ filter: { name: 'x', tags: ['a'] } });
  await listPets();
  const documents: Document[] = await searchDocuments({ query: { text: 'q', limit: 5 } });
  // @ts-expect-error text is required
  await searchDocuments({ query: { limit: 1 } });
  // A method from additionalOperations.
  const copy: Document = await copyDocument({ documentId: 'd1', Destination: '/documents/d2' });
  const owner: Owner = copy.owner;
  const related: PetQuery | undefined = copy.related;
  await getPet({ petId: 1, session: { id: 's', theme: 'dark' } });
  // Sequential media types are read as text until streaming is generated.
  const events: string = await streamEvents();
  const audit: string = await exportAudit();
  try {
    await searchPets({ body: {} });
  } catch (error) {
    if (isSearchPetsApiError(error) && error.status === 422) {
      const problem: Problem = error.body;
      void problem;
    }
  }
  return [documents, owner, related, events, audit, await getDocument({ documentId: 'd' })];
}
`;
