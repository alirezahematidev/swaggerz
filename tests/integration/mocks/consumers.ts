/**
 * A consumer program type-checked against the mocks generated for mocks-3.1.yaml (also used by
 * `pnpm compat`). `__API__` is the output path.
 */
export const MOCKS_CONSUMER = `
import type { HttpHandler } from 'msw';
import {
  makePet,
  mockCreatePet,
  mockDeletePet,
  mockGetPet,
  mockHandlers,
  type GetPetMockOptions,
} from '__API__/mocks/index.js';

export function handlers(): HttpHandler[] {
  const name: string = makePet({ name: 'Rex' }).name;
  const notFound: GetPetMockOptions = { status: 404, body: { title: 'Gone' } };
  return [
    ...mockHandlers({ delay: 10, headers: { 'x-mock': '1' } }),
    mockGetPet(notFound),
    mockGetPet({ body: ({ params }) => makePet({ id: Number(params.petId), name }) }),
    mockGetPet({ status: 409, body: { title: 'Conflict' } }),
    mockGetPet({ status: 500, body: 'anything' }),
    mockCreatePet({ body: async ({ body }) => ({ ...makePet(), ...(await body()) }) }),
    mockGetPet({ body: ({ params }) => (params.petId === '0' ? Response.error() : makePet()) }),
    mockDeletePet({ body: () => undefined }),
    // @ts-expect-error A 404 responds with a Problem, not a Pet.
    mockGetPet({ status: 404, body: makePet() }),
  ];
}
`;
